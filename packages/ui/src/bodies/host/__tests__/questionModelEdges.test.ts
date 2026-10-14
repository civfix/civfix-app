import { describe, expect, it } from "vitest"
import type { EventQuestionDTO } from "@civfix/shared"
import { answerPayload, missingRequired, questionVisible, visibleQuestions } from "@civfix/shared/host"
import { seedAnswers, toggleMultiSelect } from "../registration/questionModel"

const q = (over: Partial<EventQuestionDTO> & { id: string }): EventQuestionDTO => ({
  cleanupId: "e1",
  kind: "short_text",
  prompt: "Prompt",
  required: false,
  options: [],
  sortOrder: 0,
  ...over,
})

describe("visibleQuestions and the gate's scope", () => {
  it("hides a dependent whose gate belongs to a different ticket type", () => {
    const gate = q({ id: "gate", kind: "checkbox", ticketTypeId: "tt-vip" })
    const dep = q({ id: "dep", sortOrder: 1, showIf: { questionId: "gate", equals: true } })
    expect(visibleQuestions([gate, dep], "tt-general", { gate: true }).map((x) => x.id)).toEqual([])
    expect(visibleQuestions([gate, dep], "tt-vip", { gate: true }).map((x) => x.id)).toEqual(["gate", "dep"])
  })

  it("hides a dependent whose gate is archived", () => {
    const gate = q({ id: "gate", kind: "checkbox", archivedAt: "2026-01-01T00:00:00.000Z" })
    const dep = q({ id: "dep", showIf: { questionId: "gate", equals: true } })
    expect(visibleQuestions([gate, dep], null, { gate: true }).map((x) => x.id)).toEqual([])
  })

  it("shows a dependent whose gate is itself hidden, so long as the gate is in scope", () => {
    const root = q({ id: "root", kind: "checkbox" })
    const mid = q({ id: "mid", sortOrder: 1, showIf: { questionId: "root", equals: true } })
    const leaf = q({ id: "leaf", sortOrder: 2, showIf: { questionId: "mid", equals: "yes" } })
    expect(visibleQuestions([root, mid, leaf], null, { root: false, mid: "yes" }).map((x) => x.id)).toEqual([
      "root",
      "leaf",
    ])
  })
})

describe("questionVisible type mismatches", () => {
  const known = new Set(["gate"])
  const dep = (equals: string | boolean) => q({ id: "dep", showIf: { questionId: "gate", equals } })

  it("never matches a boolean condition against a string answer", () => {
    expect(questionVisible(dep(true), { gate: "true" }, known)).toBe(false)
  })

  it("never matches a string condition against a boolean answer", () => {
    expect(questionVisible(dep("true"), { gate: true }, known)).toBe(false)
  })

  it("hides a dependent whose gate has no answer yet", () => {
    expect(questionVisible(dep("yes"), {}, known)).toBe(false)
    expect(questionVisible(dep(false), {}, known)).toBe(false)
  })
})

describe("answers edges", () => {
  it("treats an unchecked required consent as missing", () => {
    expect(missingRequired([q({ id: "c", kind: "consent", required: true })], { c: false })).toEqual(["c"])
  })

  it("sends no entry for a question with no answer at all", () => {
    expect(answerPayload([q({ id: "a", required: true })], {})).toEqual([])
  })

  it("keeps the answer value untrimmed", () => {
    expect(answerPayload([q({ id: "a" })], { a: " hi " })).toEqual([{ questionId: "a", value: " hi " }])
  })

  it("starts a fresh selection from a non-array current value", () => {
    expect(toggleMultiSelect("stale", "x")).toEqual(["x"])
    expect(toggleMultiSelect(true, "x")).toEqual(["x"])
  })

  it("returns the same map when answers exist even for new questions", () => {
    const prev = { a: "x" }
    expect(seedAnswers(prev, [q({ id: "b" })])).toBe(prev)
  })
})
