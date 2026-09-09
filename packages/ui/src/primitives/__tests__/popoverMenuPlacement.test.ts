import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { positionPostActionMenu } from "../postActionModel"

const VIEWPORT = { width: 390, height: 844 }
const CARD = { width: 220, height: 160 }

describe("PopoverMenu placement", () => {
  it("opens BELOW the trigger with a 4px gap when the card fits there", () => {
    const anchor = { x: 320, y: 120, width: 44, height: 44 }
    expect(positionPostActionMenu(anchor, VIEWPORT, CARD)).toEqual({ left: 144, top: 168 })
  })

  it("FLIPS above a trigger near the bottom edge instead of running off screen", () => {
    const anchor = { x: 320, y: 760, width: 44, height: 44 }
    const placed = positionPostActionMenu(anchor, VIEWPORT, CARD)
    expect(placed.top).toBe(760 - CARD.height - 4)
    expect(placed.top + CARD.height).toBeLessThanOrEqual(VIEWPORT.height - 8)
  })

  it("keeps a WIDE card inside the right edge - the card grows to 320, not the assumed 220", () => {
    const anchor = { x: 330, y: 120, width: 44, height: 44 }
    const wide = { width: 320, height: 120 }
    const placed = positionPostActionMenu(anchor, VIEWPORT, wide)
    expect(placed.left).toBe(54)
    expect(placed.left + wide.width).toBeLessThanOrEqual(VIEWPORT.width - 8)
    const assumed = positionPostActionMenu(anchor, VIEWPORT, { width: 220, height: 120 })
    expect(assumed.left + wide.width).toBeGreaterThan(VIEWPORT.width)
  })

  it("left-aligns to the trigger when asked, still clamped", () => {
    expect(positionPostActionMenu({ x: 24, y: 100, width: 44, height: 44 }, VIEWPORT, CARD, "left").left)
      .toBe(24)
    expect(positionPostActionMenu({ x: 300, y: 100, width: 44, height: 44 }, VIEWPORT, CARD, "left").left)
      .toBe(VIEWPORT.width - CARD.width - 8)
  })

  it("never places a card off the top edge, even when it cannot fit either way", () => {
    const tall = { width: 220, height: 900 }
    const placed = positionPostActionMenu({ x: 10, y: 800, width: 44, height: 44 }, VIEWPORT, tall)
    expect(placed.top).toBe(8)
    expect(placed.left).toBe(8)
  })
})

describe("PopoverMenu wiring (source-pinned)", () => {
  const source = readFileSync(new URL("../PopoverMenu.tsx", import.meta.url), "utf8")

  it("routes placement through the shared solve rather than re-deriving one", () => {
    expect(source).toMatch(/positionPostActionMenu\(/)
    expect(source).not.toMatch(/anchorRect\.x \+ anchorRect\.width - CARD_WIDTH/)
  })

  it("measures the real card and closes when the viewport changes under an open menu", () => {
    expect(source).toMatch(/onCardLayout=\{anchored \? onCardLayout : undefined\}/)
    expect(source).toMatch(/openedAtRef\.current !== viewportKey\) onClose\(\)/)
  })

  it("hides the anchored card until its first layout lands, so the estimate never paints", () => {
    expect(source).toMatch(/const measuring = anchored && cardSize === null/)
    expect(source).toMatch(/useMenuMotion\(\{ visible, ready: !measuring \}\)/)
  })
})
