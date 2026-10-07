import { describe, expect, it } from "vitest"
import {
  resolveMenuPlacement,
  resolveBandLeft,
  resolveWebMenuFrame,
  CONTEXT_MENU_GAP,
  CONTEXT_MENU_EDGE_MARGIN,
} from "../messageContextMenuLayout"
import type { ContextMenuActionKey } from "../MessageContextMenu"

function anchor(y: number, height: number) {
  return { x: 24, y, width: 220, height }
}

const SCREEN_H = 800
const MENU_H = 200
const ROW_H = 48

describe("resolveMenuPlacement", () => {
  it("keeps the menu BELOW the bubble when the anchor is near the top", () => {
    const p = resolveMenuPlacement(anchor(120, 40), SCREEN_H, MENU_H, ROW_H)
    expect(p.flipped).toBe(false)
    expect(p.bubbleTop).toBe(120)
    expect(p.reactionsTop).toBe(120 - CONTEXT_MENU_GAP - ROW_H)
    expect(p.menuTop).toBe(120 + 40 + CONTEXT_MENU_GAP)
    expect(p.reactionsTop).toBeLessThan(p.bubbleTop)
    expect(p.bubbleTop).toBeLessThan(p.menuTop)
  })

  it("flips the menu ABOVE the reaction row when the anchor is near the bottom", () => {
    const p = resolveMenuPlacement(anchor(700, 40), SCREEN_H, MENU_H, ROW_H)
    expect(p.flipped).toBe(true)
    expect(p.bubbleTop).toBe(700)
    expect(p.reactionsTop).toBe(700 - CONTEXT_MENU_GAP - ROW_H)
    expect(p.menuTop).toBe(p.reactionsTop - CONTEXT_MENU_GAP - MENU_H)
    expect(p.menuTop).toBeLessThan(p.reactionsTop)
    expect(p.menuTop).toBeGreaterThanOrEqual(CONTEXT_MENU_EDGE_MARGIN)
    expect(p.menuTop + MENU_H).toBeLessThanOrEqual(SCREEN_H - CONTEXT_MENU_EDGE_MARGIN)
  })

  it("does not flip when the menu fits below exactly", () => {
    // bubbleBottom + gap + menuH lands exactly on the bottom edge margin.
    const y = SCREEN_H - CONTEXT_MENU_EDGE_MARGIN - MENU_H - CONTEXT_MENU_GAP - 40
    const p = resolveMenuPlacement(anchor(y, 40), SCREEN_H, MENU_H, ROW_H)
    expect(p.flipped).toBe(false)
    expect(p.menuTop + MENU_H).toBe(SCREEN_H - CONTEXT_MENU_EDGE_MARGIN)
  })

  it("shifts the whole stack down when the reaction row would clip the top edge", () => {
    const p = resolveMenuPlacement(anchor(10, 40), SCREEN_H, MENU_H, ROW_H)
    expect(p.flipped).toBe(false)
    expect(p.reactionsTop).toBe(CONTEXT_MENU_EDGE_MARGIN)
    // The gap structure is preserved by the shift (bubble rides down with the row).
    expect(p.bubbleTop).toBe(p.reactionsTop + ROW_H + CONTEXT_MENU_GAP)
    expect(p.menuTop).toBe(p.bubbleTop + 40 + CONTEXT_MENU_GAP)
  })

  it("clamps a flipped stack so the menu never goes above the top edge", () => {
    // Tall menu + short screen: flipped placement would push the menu past the top.
    const p = resolveMenuPlacement(anchor(300, 40), 360, 400, ROW_H)
    expect(p.flipped).toBe(true)
    expect(p.menuTop).toBeGreaterThanOrEqual(CONTEXT_MENU_EDGE_MARGIN)
  })

  it("never returns a negative top for any band", () => {
    const cases = [
      resolveMenuPlacement(anchor(0, 20), 200, 400, ROW_H),
      resolveMenuPlacement(anchor(190, 20), 200, 400, ROW_H),
      resolveMenuPlacement(anchor(0, 500), 300, 100, ROW_H),
      resolveMenuPlacement(anchor(50, 40), 100, 300, ROW_H),
    ]
    for (const p of cases) {
      expect(p.bubbleTop).toBeGreaterThanOrEqual(0)
      expect(p.reactionsTop).toBeGreaterThanOrEqual(0)
      expect(p.menuTop).toBeGreaterThanOrEqual(0)
    }
  })

  it("honors custom gap / edge margin options", () => {
    const p = resolveMenuPlacement(anchor(200, 40), SCREEN_H, MENU_H, ROW_H, {
      gap: 20,
      edgeMargin: 30,
    })
    expect(p.reactionsTop).toBe(200 - 20 - ROW_H)
    expect(p.menuTop).toBe(200 + 40 + 20)
  })
})

describe("resolveBandLeft", () => {
  const SCREEN_W = 400

  it("aligns to the bubble's leading edge and returns it unclamped when the band fits", () => {
    const rect = { x: 100, y: 0, width: 200, height: 40 }
    expect(resolveBandLeft(rect, SCREEN_W, 240, false)).toBe(100)
  })

  it("aligns to the bubble's trailing edge for a mine bubble when the band fits", () => {
    const rect = { x: 100, y: 0, width: 200, height: 40 }
    // Right edges align: left = x + width - bandWidth.
    expect(resolveBandLeft(rect, SCREEN_W, 240, true)).toBe(100 + 200 - 240)
  })

  it("clamps a leading-aligned band off the RIGHT edge back inside the margin", () => {
    const rect = { x: 350, y: 0, width: 40, height: 40 }
    expect(resolveBandLeft(rect, SCREEN_W, 240, false)).toBe(
      SCREEN_W - 240 - CONTEXT_MENU_EDGE_MARGIN,
    )
  })

  it("clamps a trailing-aligned band off the LEFT edge to the margin", () => {
    const rect = { x: 10, y: 0, width: 60, height: 40 }
    // Raw left would be 10 + 60 - 240 = -170.
    expect(resolveBandLeft(rect, SCREEN_W, 240, true)).toBe(CONTEXT_MENU_EDGE_MARGIN)
  })

  it("pins a band wider than the window to the edge margin (never negative)", () => {
    const rect = { x: 50, y: 0, width: 100, height: 40 }
    expect(resolveBandLeft(rect, 200, 400, false)).toBe(CONTEXT_MENU_EDGE_MARGIN)
    expect(resolveBandLeft(rect, 200, 400, true)).toBe(CONTEXT_MENU_EDGE_MARGIN)
  })
})

describe("ContextMenuActionKey", () => {
  it("forward-declares every phase's action key so the menu shape never changes", () => {
    // `satisfies` proves each listed key is assignable to the union; the conditional type below
    // proves the union has NO key beyond the listed eleven (both directions = exact match).
    const keys = [
      "reply",
      "copy",
      "edit",
      "pin",
      "unpin",
      "jump",
      "delete",
      "report",
      "block",
      "retractVote",
      "stopPoll",
    ] as const satisfies readonly ContextMenuActionKey[]
    const exhaustive: [ContextMenuActionKey] extends [(typeof keys)[number]] ? true : false = true
    expect(exhaustive).toBe(true)
    expect(keys).toHaveLength(11)
  })
})

describe("resolveWebMenuFrame", () => {
  const frame = { actionCount: 4, actionRowH: 38, reactionRowH: 48, cardPadV: 8, cardWidth: 264 }
  const screen = { width: 1280, height: 800 }

  it("sizes the card from its rows and opens it below a bubble near the top", () => {
    const f = resolveWebMenuFrame(anchor(120, 40), screen, frame, false)
    expect(f.cardH).toBe(48 + 4 * 38 + 8)
    expect(f.position).toEqual({ top: 120 + 40 + CONTEXT_MENU_GAP, left: 24 })
  })

  it("opens above a bubble near the bottom and trails the viewer's own bubble", () => {
    const mine = { x: 600, y: 700, width: 220, height: 40 }
    const f = resolveWebMenuFrame(mine, screen, frame, true)
    expect(f.position?.top).toBe(700 - CONTEXT_MENU_GAP - f.cardH)
    expect(f.position?.left).toBe(600 + 220 - 264)
  })

  it("caps the action list to the window and never places above the edge margin", () => {
    const tall = resolveWebMenuFrame(anchor(10, 40), { width: 1280, height: 200 }, { ...frame, actionCount: 20 }, false)
    expect(tall.actionsMaxH).toBe(Math.max(38 * 2, 200 - CONTEXT_MENU_EDGE_MARGIN * 2 - 48 - 8))
    expect(tall.cardH).toBe(48 + tall.actionsMaxH + 8)
    expect(tall.position?.top).toBeGreaterThanOrEqual(CONTEXT_MENU_EDGE_MARGIN)
  })

  it("centres (no position) without an anchor", () => {
    expect(resolveWebMenuFrame(null, screen, frame, false).position).toBeNull()
  })
})
