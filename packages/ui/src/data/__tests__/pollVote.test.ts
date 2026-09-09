import { describe, expect, it } from "vitest"
import type { PollDTO } from "@civfix/shared"
import { applyVoteLocally } from "../pollVote"

/** A 3-option poll the viewer voted option 0 on (10 total voters). */
function poll(overrides: Partial<PollDTO> = {}): PollDTO {
  return {
    question: "Best day?",
    options: [
      { idx: 0, text: "Mon", count: 4, mine: true },
      { idx: 1, text: "Tue", count: 3, mine: false },
      { idx: 2, text: "Wed", count: 3, mine: false },
    ],
    allowMultiple: false,
    anonymous: true,
    closed: false,
    totalVoters: 10,
    myVote: [0],
    ...overrides,
  }
}

describe("applyVoteLocally", () => {
  it("switching a single vote decrements the old option and increments the new one", () => {
    const next = applyVoteLocally(poll(), [1], true)
    expect(next.options[0]).toMatchObject({ count: 3, mine: false })
    expect(next.options[1]).toMatchObject({ count: 4, mine: true })
    expect(next.options[2]).toMatchObject({ count: 3, mine: false })
    // A switch keeps the same distinct voter.
    expect(next.totalVoters).toBe(10)
    expect(next.myVote).toEqual([1])
  })

  it("retracting zeros out `mine`, decrements the chosen option, and drops totalVoters", () => {
    const next = applyVoteLocally(poll(), [], true)
    expect(next.options[0]).toMatchObject({ count: 3, mine: false })
    expect(next.options.every((o) => !o.mine)).toBe(true)
    expect(next.myVote).toEqual([])
    expect(next.totalVoters).toBe(9)
  })

  it("a first vote (no prior vote) increments totalVoters", () => {
    const fresh = poll({
      options: [
        { idx: 0, text: "Mon", count: 4, mine: false },
        { idx: 1, text: "Tue", count: 3, mine: false },
        { idx: 2, text: "Wed", count: 3, mine: false },
      ],
      myVote: [],
      totalVoters: 10,
    })
    const next = applyVoteLocally(fresh, [2], false)
    expect(next.options[2]).toMatchObject({ count: 4, mine: true })
    expect(next.totalVoters).toBe(11)
    expect(next.myVote).toEqual([2])
  })

  it("adding a second choice on a multi-select ballot does NOT change totalVoters", () => {
    const multi = poll({
      allowMultiple: true,
      options: [
        { idx: 0, text: "Mon", count: 4, mine: true },
        { idx: 1, text: "Tue", count: 3, mine: false },
        { idx: 2, text: "Wed", count: 3, mine: false },
      ],
      myVote: [0],
      totalVoters: 10,
    })
    const next = applyVoteLocally(multi, [0, 1], true)
    expect(next.options[0]).toMatchObject({ count: 4, mine: true })
    expect(next.options[1]).toMatchObject({ count: 4, mine: true })
    expect(next.totalVoters).toBe(10)
    expect(next.myVote).toEqual([0, 1])
  })

  it("floors counts and totalVoters at zero against a stale snapshot", () => {
    const stale = poll({
      options: [{ idx: 0, text: "Mon", count: 0, mine: true }],
      myVote: [0],
      totalVoters: 0,
    })
    const next = applyVoteLocally(stale, [], true)
    expect(next.options[0]!.count).toBe(0)
    expect(next.totalVoters).toBe(0)
  })
})
