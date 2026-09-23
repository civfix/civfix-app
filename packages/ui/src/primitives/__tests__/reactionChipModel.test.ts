import { describe, expect, it } from "vitest"
import { REACTION_EMOJIS, type ReactionSummaryDTO } from "@civfix/shared"
import { buildReactionChipModel, REACTION_GLYPH } from "../reactionChipModel"

function summary(emoji: string, count: number, mine = false): ReactionSummaryDTO {
  return { emoji, count, mine }
}

describe("buildReactionChipModel", () => {
  it("filters out zero-count buckets", () => {
    const out = buildReactionChipModel([summary("like", 0), summary("heart", 2)])
    expect(out.map((c) => c.emoji)).toEqual(["heart"])
  })

  it("returns an empty model for no reactions", () => {
    expect(buildReactionChipModel([])).toEqual([])
    expect(buildReactionChipModel([summary("like", 0), summary("sad", 0)])).toEqual([])
  })

  it("orders chips in REACTION_EMOJIS canonical order regardless of input order", () => {
    const shuffled = ["sad", "like", "laugh", "heart"].map((e) => summary(e, 1))
    const out = buildReactionChipModel(shuffled)
    const expected = REACTION_EMOJIS.filter((e) => ["sad", "like", "laugh", "heart"].includes(e))
    expect(out.map((c) => c.emoji)).toEqual(expected)
  })

  it("passes count and mine flags through and resolves the display glyph", () => {
    const out = buildReactionChipModel([summary("heart", 3, true), summary("like", 1, false)])
    expect(out).toEqual([
      { emoji: "like", glyph: REACTION_GLYPH.like, count: 1, mine: false },
      { emoji: "heart", glyph: REACTION_GLYPH.heart, count: 3, mine: true },
    ])
  })

  it("drops unknown reaction names defensively", () => {
    const out = buildReactionChipModel([summary("rocket", 5), summary("like", 1)])
    expect(out.map((c) => c.emoji)).toEqual(["like"])
  })

  it("has a glyph for every reaction in the canonical set", () => {
    for (const name of REACTION_EMOJIS) {
      expect(REACTION_GLYPH[name]).toBeTruthy()
    }
  })
})
