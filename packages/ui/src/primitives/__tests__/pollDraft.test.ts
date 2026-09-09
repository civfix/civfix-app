import { describe, expect, it } from "vitest"
import {
  emptyPollDraft,
  setQuestion,
  setOption,
  removeOption,
  normalizeOptions,
  canCreatePoll,
  toCreateInput,
  POLL_QUESTION_MAX,
  POLL_OPTION_MAX,
  POLL_MIN_OPTIONS,
  POLL_MAX_OPTIONS,
} from "../pollDraft"

describe("pollDraft", () => {
  it("starts empty with POLL_MIN_OPTIONS blank rows", () => {
    const d = emptyPollDraft()
    expect(d.question).toBe("")
    expect(d.options).toEqual(["", ""])
    expect(d.options.length).toBe(POLL_MIN_OPTIONS)
  })

  it("caps the question at POLL_QUESTION_MAX", () => {
    const long = "x".repeat(POLL_QUESTION_MAX + 50)
    expect(setQuestion(emptyPollDraft(), long).question.length).toBe(POLL_QUESTION_MAX)
  })

  it("caps each option at POLL_OPTION_MAX", () => {
    const long = "y".repeat(POLL_OPTION_MAX + 20)
    const d = setOption(emptyPollDraft(), 0, long)
    expect(d.options[0]!.length).toBe(POLL_OPTION_MAX)
  })

  it("auto-appends a blank row once the LAST row becomes non-blank", () => {
    // Typing into the second (last) row appends a third empty row.
    const d = setOption(emptyPollDraft(), 1, "Second")
    expect(d.options).toEqual(["", "Second", ""])
  })

  it("does NOT auto-append when editing a non-last row", () => {
    const d = setOption(emptyPollDraft(), 0, "First")
    // Row 0 is not the last row, so no append.
    expect(d.options).toEqual(["First", ""])
  })

  it("auto-append stops at POLL_MAX_OPTIONS (10)", () => {
    let d = emptyPollDraft()
    // Fill rows until we reach the cap; each non-last-blank fill appends one.
    for (let i = 0; i < POLL_MAX_OPTIONS + 5; i++) {
      const lastIdx = d.options.length - 1
      d = setOption(d, lastIdx, `opt${i}`)
      expect(d.options.length).toBeLessThanOrEqual(POLL_MAX_OPTIONS)
    }
    expect(d.options.length).toBe(POLL_MAX_OPTIONS)
    // Filling the last row while at the cap does NOT grow the list further.
    const capped = setOption(d, POLL_MAX_OPTIONS - 1, "still full")
    expect(capped.options.length).toBe(POLL_MAX_OPTIONS)
  })

  it("removeOption drops a row only while above POLL_MIN_OPTIONS", () => {
    // At the floor: no-op.
    const floor = emptyPollDraft()
    expect(removeOption(floor, 0)).toBe(floor)
    // Above the floor: removes.
    const three = setOption(emptyPollDraft(), 1, "B") // -> ["", "B", ""]
    const removed = removeOption(three, 0)
    expect(removed.options).toEqual(["B", ""])
  })

  it("removeOption is a no-op for an out-of-range index", () => {
    const three = setOption(emptyPollDraft(), 1, "B")
    expect(removeOption(three, 9)).toBe(three)
  })

  it("normalizeOptions trims and drops blank rows", () => {
    expect(normalizeOptions(["  A ", "", "  ", "B"])).toEqual(["A", "B"])
  })

  it("canCreatePoll requires a non-empty question AND >= 2 real options", () => {
    expect(canCreatePoll({ question: "  ", options: ["A", "B"] })).toBe(false)
    expect(canCreatePoll({ question: "Q?", options: ["A", ""] })).toBe(false)
    expect(canCreatePoll({ question: "Q?", options: ["A", "B", ""] })).toBe(true)
  })

  it("toCreateInput trims the question and blank rows", () => {
    expect(toCreateInput({ question: "  Pick one  ", options: ["  A", "B ", "", "  "] })).toEqual({
      question: "Pick one",
      options: ["A", "B"],
    })
  })
})
