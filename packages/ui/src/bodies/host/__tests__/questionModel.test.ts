import { describe, expect, it } from "vitest"
import type { EventQuestionDTO } from "@civfix/shared"
import { visibleQuestions } from "@civfix/shared/host"
import {
  initialAnswer,
  initialAnswers,
  seedAnswers,
  toggleMultiSelect,
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

describe("multi-select answers", () => {
  it("toggles a multi-select value without mutating the previous array", () => {
    const before = ["x"]
    expect(toggleMultiSelect(before, "y")).toEqual(["x", "y"])
    expect(toggleMultiSelect(before, "x")).toEqual([])
    expect(before).toEqual(["x"])
    expect(toggleMultiSelect(undefined, "x")).toEqual(["x"])
  })
})
