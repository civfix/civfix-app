import { describe, expect, it } from "vitest"
import {
  LIGHTBOX_CHEVRON_GUTTER,
  LIGHTBOX_CLOSE_GUTTER,
  LIGHTBOX_FALLBACK_ASPECT_RATIO,
  LIGHTBOX_STAGE_MAX_WIDTH,
  LIGHTBOX_STAGE_PADDING_X,
  LIGHTBOX_STAGE_PADDING_Y,
  lightboxAspectRatio,
  lightboxControlOffsets,
  lightboxMediaHeight,
  lightboxMediaWidth,
} from "../lightboxStage"

describe("lightboxAspectRatio", () => {
  it("takes the item's intrinsic ratio", () => {
    expect(lightboxAspectRatio({ width: 1600, height: 900 })).toBeCloseTo(16 / 9)
    expect(lightboxAspectRatio({ width: 3024, height: 4032 })).toBeCloseTo(0.75)
  })

  it("falls back to 16:9 only when there are no usable dimensions", () => {
    expect(lightboxAspectRatio(null)).toBe(LIGHTBOX_FALLBACK_ASPECT_RATIO)
    expect(lightboxAspectRatio(undefined)).toBe(LIGHTBOX_FALLBACK_ASPECT_RATIO)
    expect(lightboxAspectRatio({})).toBe(LIGHTBOX_FALLBACK_ASPECT_RATIO)
    expect(lightboxAspectRatio({ width: 1600, height: null })).toBe(LIGHTBOX_FALLBACK_ASPECT_RATIO)
    expect(lightboxAspectRatio({ width: 0, height: 900 })).toBe(LIGHTBOX_FALLBACK_ASPECT_RATIO)
    expect(lightboxAspectRatio({ width: -4, height: 3 })).toBe(LIGHTBOX_FALLBACK_ASPECT_RATIO)
    expect(lightboxAspectRatio({ width: Number.NaN, height: 3 })).toBe(LIGHTBOX_FALLBACK_ASPECT_RATIO)
  })
})

describe("lightboxMediaWidth", () => {
  const phone = { windowWidth: 390, windowHeight: 844 }

  it("spends the full stage width on a landscape item", () => {
    const width = lightboxMediaWidth({ ratio: 16 / 9, ...phone })
    expect(width).toBe(390 - LIGHTBOX_STAGE_PADDING_X * 2)
  })

  it("bounds a tall item by the available height, not the width", () => {
    const ratio = 3 / 4
    const window = { windowWidth: 1280, windowHeight: 800 }
    const width = lightboxMediaWidth({ ratio, ...window })
    const available = window.windowHeight - LIGHTBOX_STAGE_PADDING_Y * 2
    expect(width).toBeCloseTo(available * ratio)
    expect(width / ratio).toBeLessThanOrEqual(available)
    expect(width).toBeLessThan(LIGHTBOX_STAGE_MAX_WIDTH - LIGHTBOX_STAGE_PADDING_X * 2)
  })

  it("keeps a portrait photo inside a phone screen", () => {
    const ratio = 3 / 4
    const width = lightboxMediaWidth({ ratio, ...phone })
    expect(width).toBe(phone.windowWidth - LIGHTBOX_STAGE_PADDING_X * 2)
    expect(width / ratio).toBeLessThanOrEqual(phone.windowHeight - LIGHTBOX_STAGE_PADDING_Y * 2)
  })

  it("caps the stage on a desktop window", () => {
    const width = lightboxMediaWidth({ ratio: 16 / 9, windowWidth: 2560, windowHeight: 1440 })
    expect(width).toBe(LIGHTBOX_STAGE_MAX_WIDTH - LIGHTBOX_STAGE_PADDING_X * 2)
  })

  it("never returns a non-positive width", () => {
    expect(lightboxMediaWidth({ ratio: 16 / 9, windowWidth: 0, windowHeight: 0 })).toBe(1)
    expect(lightboxMediaWidth({ ratio: 3 / 4, windowWidth: 100, windowHeight: 40 })).toBe(1)
  })

  it("survives a garbage ratio by falling back", () => {
    const bad = lightboxMediaWidth({ ratio: Number.NaN, ...phone })
    expect(bad).toBe(lightboxMediaWidth({ ratio: LIGHTBOX_FALLBACK_ASPECT_RATIO, ...phone }))
  })
})

describe("lightboxMediaHeight", () => {
  it("derives the stage height from the width and the ratio", () => {
    expect(lightboxMediaHeight(320, 16 / 9)).toBeCloseTo(180)
    expect(lightboxMediaHeight(342, 3 / 4)).toBeCloseTo(456)
  })

  it("falls back with the width, never to zero", () => {
    expect(lightboxMediaHeight(320, Number.NaN)).toBeCloseTo(320 / LIGHTBOX_FALLBACK_ASPECT_RATIO)
    expect(lightboxMediaHeight(0, 16 / 9)).toBe(1)
    expect(lightboxMediaHeight(-10, 16 / 9)).toBe(1)
    expect(lightboxMediaHeight(320, 0)).toBeCloseTo(320 / LIGHTBOX_FALLBACK_ASPECT_RATIO)
  })
})

describe("lightboxControlOffsets", () => {
  it("adds the device safe area to the token gutter, so the X clears the notch", () => {
    const offsets = lightboxControlOffsets({ top: 59, right: 0, bottom: 34, left: 0 })
    expect(offsets.close).toEqual({ top: 59 + LIGHTBOX_CLOSE_GUTTER, right: LIGHTBOX_CLOSE_GUTTER })
    expect(offsets.prev).toEqual({ left: LIGHTBOX_CHEVRON_GUTTER })
    expect(offsets.next).toEqual({ right: LIGHTBOX_CHEVRON_GUTTER })
  })

  it("clears a landscape notch on either side", () => {
    const offsets = lightboxControlOffsets({ top: 0, right: 59, bottom: 21, left: 59 })
    expect(offsets.close).toEqual({ top: LIGHTBOX_CLOSE_GUTTER, right: 59 + LIGHTBOX_CLOSE_GUTTER })
    expect(offsets.prev).toEqual({ left: 59 + LIGHTBOX_CHEVRON_GUTTER })
    expect(offsets.next).toEqual({ right: 59 + LIGHTBOX_CHEVRON_GUTTER })
  })

  it("degrades to the bare token gutters where no provider reports insets (web)", () => {
    const bare = lightboxControlOffsets(null)
    expect(bare.close).toEqual({ top: LIGHTBOX_CLOSE_GUTTER, right: LIGHTBOX_CLOSE_GUTTER })
    expect(lightboxControlOffsets(undefined)).toEqual(bare)
    expect(lightboxControlOffsets({})).toEqual(bare)
    expect(lightboxControlOffsets({ top: Number.NaN, right: -12 })).toEqual(bare)
  })
})
