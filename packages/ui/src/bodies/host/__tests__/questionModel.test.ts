import { describe, expect, it } from "vitest"
import type { EventQuestionDTO } from "@civfix/shared"
import {
  answerIsBlank,
  answerPayload,
  initialAnswer,
  initialAnswers,
  missingRequired,
  questionVisible,
  seedAnswers,
  toggleMultiSelect,
  visibleQuestions,
} from "../registration/questionModel"

const q = (over: Partial<EventQuestionDTO> & { id: string }): EventQuestionDTO => ({
  cleanupId: "e1",
  kind: "short_text",
  prompt: "Prompt",
  required: false,
  options: [],
  sortOrder: 0,
  ...over,
})

describe("initial answers", () => {
  it("starts each kind at a value the input can control from the first render", () => {
    expect(initialAnswer(q({ id: "a", kind: "short_text" }))).toBe("")
    expect(initialAnswer(q({ id: "b", kind: "long_text" }))).toBe("")
    expect(initialAnswer(q({ id: "c", kind: "single_select" }))).toBe("")
    expect(initialAnswer(q({ id: "d", kind: "multi_select" }))).toEqual([])
    expect(initialAnswer(q({ id: "e", kind: "checkbox" }))).toBe(false)
    expect(initialAnswer(q({ id: "f", kind: "consent" }))).toBe(false)
    expect(initialAnswers([q({ id: "a" }), q({ id: "e", kind: "checkbox" })])).toEqual({
      a: "",
      e: false,
    })
  })
})

describe("seedAnswers", () => {
  const optIn = q({ id: "opt-in", kind: "checkbox", prompt: "Bringing a car?" })
  const parking = q({
    id: "parking",
    prompt: "How will you get here?",
    showIf: { questionId: "opt-in", equals: false },
  })

  it("shows an UNCHECKED-box dependent only once the answers were seeded", () => {
    expect(visibleQuestions([optIn, parking], null, {}).map((x) => x.id)).toEqual(["opt-in"])
    const seeded = seedAnswers({}, [optIn, parking])
    expect(seeded).toEqual({ "opt-in": false, parking: "" })
    expect(visibleQuestions([optIn, parking], null, seeded).map((x) => x.id)).toEqual([
      "opt-in",
      "parking",
    ])
  })

  it("never overwrites answers already in hand, and is a no-op before the questions arrive", () => {
    const typed = { "opt-in": true }
    expect(seedAnswers(typed, [optIn, parking])).toBe(typed)
    const empty = {}
    expect(seedAnswers(empty, [])).toBe(empty)
  })
})

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

  it("orders by sortOrder rather than by array position", () => {
    const list = visibleQuestions([q({ id: "b", sortOrder: 2 }), q({ id: "a", sortOrder: 1 })], null, {})
    expect(list.map((x) => x.id)).toEqual(["a", "b"])
  })
})

describe("showIf (single level, by contract)", () => {
  const known = new Set(["gate"])

  it("shows an unconditional question", () => {
    expect(questionVisible(q({ id: "a" }), {}, known)).toBe(true)
  })

  it("matches a string answer, a checkbox boolean, and a multi-select membership", () => {
    const dep = (equals: string | boolean) =>
      q({ id: "dep", showIf: { questionId: "gate", equals } })
    expect(questionVisible(dep("yes"), { gate: "yes" }, known)).toBe(true)
    expect(questionVisible(dep("yes"), { gate: "no" }, known)).toBe(false)
    expect(questionVisible(dep(true), { gate: true }, known)).toBe(true)
    expect(questionVisible(dep(true), { gate: false }, known)).toBe(false)
    expect(questionVisible(dep("x"), { gate: ["x", "y"] }, known)).toBe(true)
    expect(questionVisible(dep("z"), { gate: ["x", "y"] }, known)).toBe(false)
  })

  it("HIDES a question whose gate is not in the shown set - the safe direction", () => {
    const dep = q({ id: "dep", showIf: { questionId: "elsewhere", equals: "yes" } })
    expect(questionVisible(dep, { elsewhere: "yes" }, known)).toBe(false)
  })

  it("hides an unanswered gate's dependents inside the real selector", () => {
    const questions = [
      q({ id: "gate", kind: "checkbox", sortOrder: 0 }),
      q({ id: "dep", sortOrder: 1, showIf: { questionId: "gate", equals: true } }),
    ]
    expect(visibleQuestions(questions, null, { gate: false }).map((x) => x.id)).toEqual(["gate"])
    expect(visibleQuestions(questions, null, { gate: true }).map((x) => x.id)).toEqual(["gate", "dep"])
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

  it("submits only questions that were SHOWN, and drops blank optional answers", () => {
    const shown = [q({ id: "a" }), q({ id: "b", required: true })]
    const payload = answerPayload(shown, { a: "", b: "yes", hidden: "leaked" })
    expect(payload).toEqual([{ questionId: "b", value: "yes" }])
  })

  it("toggles a multi-select value without mutating the previous array", () => {
    const before = ["x"]
    expect(toggleMultiSelect(before, "y")).toEqual(["x", "y"])
    expect(toggleMultiSelect(before, "x")).toEqual([])
    expect(before).toEqual(["x"])
    expect(toggleMultiSelect(undefined, "x")).toEqual(["x"])
  })
})
