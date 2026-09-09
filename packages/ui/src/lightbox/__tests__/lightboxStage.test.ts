import { describe, expect, it } from "vitest"
import {
  LIGHTBOX_FALLBACK_ASPECT_RATIO,
  LIGHTBOX_STAGE_MAX_WIDTH,
  LIGHTBOX_STAGE_PADDING_X,
  LIGHTBOX_STAGE_PADDING_Y,
  lightboxAspectRatio,
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
