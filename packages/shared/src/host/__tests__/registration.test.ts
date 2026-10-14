import { describe, expect, it } from "vitest"
import type { TicketTypeDTO } from "../../schemas/entities.js"
import type { EventQuestionDTO } from "../../schemas/host/questions.js"
import {
  answerIsBlank,
  answerPayload,
  clampPartySize,
  defaultTicketTypeId,
  missingRequired,
  questionVisible,
  registerOutcomeKey,
  sortedTicketTypes,
  ticketTypeSelectable,
  visibleQuestions,
  type AnswerMap,
} from "../registration.js"

const q = (over: Partial<EventQuestionDTO> & { id: string }): EventQuestionDTO => ({
  cleanupId: "e1",
  kind: "short_text",
  prompt: "Prompt",
  required: false,
  options: [],
  sortOrder: 0,
  ...over,
})

const type = (over: Partial<TicketTypeDTO> = {}): TicketTypeDTO => ({
  id: "tt1",
  cleanupId: "e1",
  name: "General",
  reserved: 0,
  sold: 0,
  visibility: "public",
  accessCodeSet: false,
  maxPartySize: 1,
  sortOrder: 0,
  questionIds: [],
  soldOut: false,
  salesOpen: true,
  waitlistEnabled: false,
  ...over,
})

const shownFor = (questions: readonly EventQuestionDTO[], answers: AnswerMap, ticketTypeId: string | null = null) =>
  visibleQuestions(questions, ticketTypeId, answers)

describe("visibleQuestions", () => {
  it("drops archived definitions", () => {
    const list = visibleQuestions([q({ id: "a", archivedAt: "2026-01-01T00:00:00.000Z" })], null, {})
    expect(list).toHaveLength(0)
  })

  it("scopes a ticket-type question to that type, and keeps the unscoped ones everywhere", () => {
    const questions = [q({ id: "all" }), q({ id: "vip", ticketTypeId: "tt-vip" })]
    expect(visibleQuestions(questions, "tt-vip", {}).map((x) => x.id)).toEqual(["all", "vip"])
    expect(visibleQuestions(questions, "tt-general", {}).map((x) => x.id)).toEqual(["all"])
    expect(visibleQuestions(questions, null, {}).map((x) => x.id)).toEqual(["all"])
  })

  it("keeps global questions and this ticket's questions, and drops archived ones", () => {
    const questions = [
      q({ id: "q1" }),
      q({ id: "q2", ticketTypeId: "t1" }),
      q({ id: "q3", ticketTypeId: "t2" }),
      q({ id: "q4", archivedAt: "2026-01-01T00:00:00.000Z" }),
    ]
    expect(visibleQuestions(questions, "t1", {}).map((entry) => entry.id)).toEqual(["q1", "q2"])
  })

  it("orders by sortOrder rather than by array position", () => {
    const list = visibleQuestions([q({ id: "b", sortOrder: 2 }), q({ id: "a", sortOrder: 1 })], null, {})
    expect(list.map((x) => x.id)).toEqual(["a", "b"])
  })

  it("hides an unanswered gate's dependents inside the real selector", () => {
    const questions = [
      q({ id: "gate", kind: "checkbox", sortOrder: 0 }),
      q({ id: "dep", sortOrder: 1, showIf: { questionId: "gate", equals: true } }),
    ]
    expect(visibleQuestions(questions, null, { gate: false }).map((x) => x.id)).toEqual(["gate"])
    expect(visibleQuestions(questions, null, { gate: true }).map((x) => x.id)).toEqual(["gate", "dep"])
  })

  it("shows an UNCHECKED-box dependent only once the gate holds an answer", () => {
    const optIn = q({ id: "opt-in", kind: "checkbox", prompt: "Bringing a car?" })
    const parking = q({ id: "parking", showIf: { questionId: "opt-in", equals: false } })
    expect(visibleQuestions([optIn, parking], null, {}).map((x) => x.id)).toEqual(["opt-in"])
    expect(visibleQuestions([optIn, parking], null, { "opt-in": false }).map((x) => x.id)).toEqual([
      "opt-in",
      "parking",
    ])
  })

  it("hides a question gated on another ticket type's question, however that question was answered", () => {
    const questions = [
      q({ id: "forB", ticketTypeId: "tB" }),
      q({ id: "dep", showIf: { questionId: "forB", equals: "yes" } }),
    ]
    expect(visibleQuestions(questions, "tA", { forB: "yes" }).map((x) => x.id)).toEqual([])
    expect(visibleQuestions(questions, "tB", { forB: "yes" }).map((x) => x.id)).toEqual(["forB", "dep"])
  })
})

describe("showIf (single level, by contract)", () => {
  const known = new Set(["gate"])

  it("shows an unconditional question", () => {
    expect(questionVisible(q({ id: "a" }), {}, known)).toBe(true)
  })

  it("matches a string answer, a checkbox boolean, and a multi-select membership", () => {
    const dep = (equals: string | boolean) => q({ id: "dep", showIf: { questionId: "gate", equals } })
    expect(questionVisible(dep("yes"), { gate: "yes" }, known)).toBe(true)
    expect(questionVisible(dep("yes"), { gate: "no" }, known)).toBe(false)
    expect(questionVisible(dep(true), { gate: true }, known)).toBe(true)
    expect(questionVisible(dep(true), { gate: false }, known)).toBe(false)
    expect(questionVisible(dep("x"), { gate: ["x", "y"] }, known)).toBe(true)
    expect(questionVisible(dep("z"), { gate: ["x", "y"] }, known)).toBe(false)
  })

  it("hides a conditional question until its trigger is answered", () => {
    const conditional = q({ id: "q2", showIf: { questionId: "q1", equals: "yes" } })
    const gate = new Set(["q1"])
    expect(questionVisible(conditional, {}, gate)).toBe(false)
    expect(questionVisible(conditional, { q1: "no" }, gate)).toBe(false)
    expect(questionVisible(conditional, { q1: "yes" }, gate)).toBe(true)
    expect(questionVisible(conditional, { q1: ["yes", "maybe"] }, gate)).toBe(true)
  })

  it("HIDES a question whose gate is not in the shown set - the safe direction", () => {
    const dep = q({ id: "dep", showIf: { questionId: "elsewhere", equals: "yes" } })
    expect(questionVisible(dep, { elsewhere: "yes" }, known)).toBe(false)
  })
})

describe("validation + payload", () => {
  it("treats whitespace, an empty selection and an unchecked box as blank", () => {
    expect(answerIsBlank(undefined)).toBe(true)
    expect(answerIsBlank("   ")).toBe(true)
    expect(answerIsBlank([])).toBe(true)
    expect(answerIsBlank(false)).toBe(true)
    expect(answerIsBlank("a")).toBe(false)
    expect(answerIsBlank(["a"])).toBe(false)
    expect(answerIsBlank(true)).toBe(false)
  })

  it("names every required question that is still blank", () => {
    const questions = [q({ id: "a", required: true }), q({ id: "b" })]
    expect(missingRequired(questions, { a: "", b: "" })).toEqual(["a"])
    expect(missingRequired(questions, { a: "x", b: "" })).toEqual([])
  })

  it("never demands an answer to a hidden required question", () => {
    const questions = [
      q({ id: "q1" }),
      q({ id: "q2", required: true, showIf: { questionId: "q1", equals: "yes" } }),
    ]
    expect(missingRequired(shownFor(questions, {}), {})).toEqual([])
    expect(missingRequired(shownFor(questions, { q1: "yes" }), { q1: "yes" })).toEqual(["q2"])
    const answered = { q1: "yes", q2: "answer" }
    expect(missingRequired(shownFor(questions, answered), answered)).toEqual([])
  })

  it("never demands, nor submits, a question belonging to a DIFFERENT ticket type", () => {
    const questions = [
      q({ id: "shared" }),
      q({ id: "forA", ticketTypeId: "tA", required: true }),
      q({ id: "forB", ticketTypeId: "tB", required: true }),
    ]
    const complete = { shared: "x", forA: "a" }
    expect(missingRequired(shownFor(questions, complete, "tA"), complete)).toEqual([])
    expect(missingRequired(shownFor(questions, { shared: "x" }, "tA"), { shared: "x" })).toEqual(["forA"])
    const stale = { shared: "x", forA: "a", forB: "stale" }
    expect(answerPayload(shownFor(questions, stale, "tA"), stale)).toEqual([
      { questionId: "shared", value: "x" },
      { questionId: "forA", value: "a" },
    ])
  })

  it("submits only questions that were SHOWN, and drops blank optional answers", () => {
    const shown = [q({ id: "a" }), q({ id: "b", required: true })]
    const payload = answerPayload(shown, { a: "", b: "yes", hidden: "leaked" })
    expect(payload).toEqual([{ questionId: "b", value: "yes" }])
  })

  it("sends only visible, answered questions", () => {
    const questions = [q({ id: "q1" }), q({ id: "q2", showIf: { questionId: "q1", equals: "yes" } })]
    const yes = { q1: "yes", q2: "detail" }
    expect(answerPayload(shownFor(questions, yes), yes)).toEqual([
      { questionId: "q1", value: "yes" },
      { questionId: "q2", value: "detail" },
    ])
    const no = { q1: "no", q2: "stale" }
    expect(answerPayload(shownFor(questions, no), no)).toEqual([{ questionId: "q1", value: "no" }])
  })

  it("sends nothing for a blank answer, required or not", () => {
    const shown = [q({ id: "box", kind: "consent", required: true }), q({ id: "pick", kind: "multi_select" })]
    expect(answerPayload(shown, { box: false, pick: [] })).toEqual([])
  })
})

describe("party size", () => {
  it("clamps into the ticket's own bound", () => {
    expect(clampPartySize(0, 4)).toBe(1)
    expect(clampPartySize(9, 4)).toBe(4)
    expect(clampPartySize(Number.NaN, 4)).toBe(1)
    expect(clampPartySize(2.7, 4)).toBe(2)
  })

  it("never offers a fractional or sub-one ceiling", () => {
    expect(clampPartySize(9, 3.9)).toBe(3)
    expect(clampPartySize(9, 0)).toBe(1)
  })
})

describe("ticket type selection", () => {
  it("orders by the host's sort order", () => {
    const ordered = sortedTicketTypes([type({ id: "b", sortOrder: 2 }), type({ id: "a", sortOrder: 1 })])
    expect(ordered.map((t) => t.id)).toEqual(["a", "b"])
  })

  it("keeps the server's order between types that share a sort order", () => {
    const ordered = sortedTicketTypes([
      type({ id: "z", name: "Zed", sortOrder: 0 }),
      type({ id: "a", name: "Ann", sortOrder: 0 }),
    ])
    expect(ordered.map((t) => t.id)).toEqual(["z", "a"])
  })

  it("offers a type only while its sales are open and it has room", () => {
    expect(ticketTypeSelectable(type())).toBe(true)
    expect(ticketTypeSelectable(type({ soldOut: true }))).toBe(false)
    expect(ticketTypeSelectable(type({ salesOpen: false }))).toBe(false)
  })

  it("preselects the first type that is actually open", () => {
    expect(
      defaultTicketTypeId([type({ id: "sold", sortOrder: 0, soldOut: true }), type({ id: "open", sortOrder: 1 })]),
    ).toBe("open")
    expect(
      defaultTicketTypeId([type({ id: "t2", sortOrder: 1 }), type({ id: "t1", sortOrder: 0, soldOut: true })]),
    ).toBe("t2")
  })

  it("falls back to the first type when none are open, so the picker is never blank", () => {
    expect(defaultTicketTypeId([type({ id: "a", sortOrder: 0, soldOut: true })])).toBe("a")
    expect(defaultTicketTypeId([])).toBeNull()
  })
})

describe("register outcome copy", () => {
  it("renders NO error for the three success arms", () => {
    expect(registerOutcomeKey("registered")).toBeNull()
    expect(registerOutcomeKey("replayed")).toBeNull()
    expect(registerOutcomeKey("waitlisted")).toBeNull()
  })

  it("gives every refusal its own copy key", () => {
    const refusals = [
      "already_registered",
      "full",
      "party_too_large",
      "sales_closed",
      "registration_closed",
      "ticket_type_not_found",
      "access_code_required",
      "access_code_invalid",
      "answers_invalid",
      "banned",
      "closed",
      "not_found",
    ] as const
    const keys = refusals.map((outcome) => registerOutcomeKey(outcome))
    expect(keys.every((key) => typeof key === "string")).toBe(true)
    expect(new Set(keys).size).toBe(refusals.length)
    for (const outcome of refusals) expect(registerOutcomeKey(outcome)).toBe(`outcome.${outcome}`)
  })
})
