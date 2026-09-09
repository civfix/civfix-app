import { describe, expect, it } from "vitest"
import { pollInteractivity, reconcilePollSelection } from "../pollBubbleModel"

describe("pollInteractivity", () => {
  it("an open poll the viewer has not voted on is votable and not inert", () => {
    expect(pollInteractivity({ closed: false, disabled: false, myVote: [] })).toEqual({
      showResults: false,
      votable: true,
      inert: false,
    })
  })

  it("a disabled OPEN poll with no vote yet is INERT - the case that used to look tappable", () => {
    expect(pollInteractivity({ closed: false, disabled: true, myVote: [] })).toEqual({
      showResults: false,
      votable: false,
      inert: true,
    })
  })

  it("results are never inert - a closed or already-voted poll is informative, not broken", () => {
    expect(pollInteractivity({ closed: true, disabled: true, myVote: [] }).inert).toBe(false)
    expect(pollInteractivity({ closed: false, disabled: true, myVote: [1] }).inert).toBe(false)
    expect(pollInteractivity({ closed: true, disabled: false, myVote: [] })).toEqual({
      showResults: true,
      votable: false,
      inert: false,
    })
  })

  it("an open poll the viewer already voted on stays votable (single-answer switch)", () => {
    expect(pollInteractivity({ closed: false, disabled: false, myVote: [2] })).toEqual({
      showResults: true,
      votable: true,
      inert: false,
    })
  })
})

describe("reconcilePollSelection", () => {
  it("keeps the pending selection when the server says the viewer has no vote (the rollback)", () => {
    const pending = new Set([0, 2])
    expect(reconcilePollSelection(pending, [])).toBe(pending)
  })

  it("keeps the same Set instance when the vote already matches, so no render loop can start", () => {
    const committed = new Set([1, 3])
    expect(reconcilePollSelection(committed, [3, 1])).toBe(committed)
  })

  it("adopts the DTO's vote when it differs (another device, or a settled server response)", () => {
    expect([...reconcilePollSelection(new Set([0]), [1, 2])]).toEqual([1, 2])
  })

  it("adopts a vote that merely EXTENDS the local selection", () => {
    expect([...reconcilePollSelection(new Set([0]), [0, 1])]).toEqual([0, 1])
  })

  it("the vote/rollback/retry round trip preserves the picks end to end", () => {
    const picked = new Set([0, 2])
    const optimistic = reconcilePollSelection(picked, [0, 2])
    const rolledBack = reconcilePollSelection(optimistic, [])
    expect([...rolledBack]).toEqual([0, 2])
  })
})
