import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  LIGHTBOX_DOUBLE_TAP_SCALE,
  LIGHTBOX_MAX_SCALE,
  LIGHTBOX_MIN_SCALE,
  LIGHTBOX_ZOOM_SNAP_SCALE,
  ZOOM_IDENTITY,
  clampZoomScale,
  clampZoomTransform,
  cssZoomTransform,
  doubleTapZoomTransform,
  focalZoomTransform,
  isZoomed,
  panZoomTransform,
  pointerDistance,
  pointerMidpoint,
  settleZoomTransform,
  travelExceeds,
  wheelZoomScale,
  zoomGeometry,
  zoomTranslationLimits,
} from "../lightboxZoom"

const phone = zoomGeometry({
  contentWidth: 300,
  contentHeight: 400,
  viewportWidth: 300,
  viewportHeight: 400,
})

const letterboxed = zoomGeometry({
  contentWidth: 342,
  contentHeight: 192,
  viewportWidth: 390,
  viewportHeight: 844,
})

describe("clampZoomScale", () => {
  it("holds the scale inside [1, maxScale]", () => {
    expect(clampZoomScale(0.2)).toBe(LIGHTBOX_MIN_SCALE)
    expect(clampZoomScale(1)).toBe(1)
    expect(clampZoomScale(2.5)).toBe(2.5)
    expect(clampZoomScale(99)).toBe(LIGHTBOX_MAX_SCALE)
    expect(clampZoomScale(99, 3)).toBe(3)
  })

  it("never lets a maxScale below 1 invert the range", () => {
    expect(clampZoomScale(2, 0.5)).toBe(LIGHTBOX_MIN_SCALE)
    expect(clampZoomScale(2, Number.NaN)).toBe(2)
  })

  it("falls back to 1 on garbage", () => {
    expect(clampZoomScale(Number.NaN)).toBe(1)
    expect(clampZoomScale(Number.POSITIVE_INFINITY)).toBe(1)
  })
})

describe("isZoomed", () => {
  it("treats anything at or under the snap threshold as unzoomed", () => {
    expect(isZoomed(1)).toBe(false)
    expect(isZoomed(LIGHTBOX_ZOOM_SNAP_SCALE)).toBe(false)
    expect(isZoomed(LIGHTBOX_ZOOM_SNAP_SCALE + 0.01)).toBe(true)
    expect(isZoomed(Number.NaN)).toBe(false)
  })
})

describe("zoomTranslationLimits", () => {
  it("allows no translation while the content fits the viewport", () => {
    expect(zoomTranslationLimits(1, phone)).toEqual({ x: 0, y: 0 })
    expect(zoomTranslationLimits(1, letterboxed)).toEqual({ x: 0, y: 0 })
  })

  it("allows exactly the overflow, halved, per axis", () => {
    expect(zoomTranslationLimits(2, phone)).toEqual({ x: 150, y: 200 })
    expect(zoomTranslationLimits(2, letterboxed)).toEqual({ x: 147, y: 0 })
    expect(zoomTranslationLimits(4, letterboxed)).toEqual({ x: (342 * 4 - 390) / 2, y: 0 })
  })

  it("clamps the scale before measuring", () => {
    expect(zoomTranslationLimits(99, phone)).toEqual(zoomTranslationLimits(LIGHTBOX_MAX_SCALE, phone))
  })
})

describe("clampZoomTransform", () => {
  it("pulls a runaway translation back to the bound, leaving no empty gutter", () => {
    expect(clampZoomTransform({ scale: 2, x: 900, y: -900 }, phone)).toEqual({ scale: 2, x: 150, y: -200 })
  })

  it("recentres whenever the axis cannot overflow", () => {
    expect(clampZoomTransform({ scale: 1, x: 40, y: -40 }, phone)).toEqual({ scale: 1, x: 0, y: 0 })
    expect(clampZoomTransform({ scale: 2, x: 10, y: 90 }, letterboxed)).toEqual({ scale: 2, x: 10, y: 0 })
  })

  it("survives a non-finite transform", () => {
    expect(clampZoomTransform({ scale: Number.NaN, x: Number.NaN, y: Number.NaN }, phone)).toEqual({
      scale: 1,
      x: 0,
      y: 0,
    })
  })
})

describe("focalZoomTransform", () => {
  const surface = { surfaceWidth: 300, surfaceHeight: 400 }

  it("keeps the pinched point under the fingers", () => {
    const next = focalZoomTransform({
      transform: ZOOM_IDENTITY,
      nextScale: 2,
      focalX: 300,
      focalY: 400,
      geometry: phone,
      ...surface,
    })
    expect(next).toEqual({ scale: 2, x: -150, y: -200 })
  })

  it("anchors the same content point across a second zoom step", () => {
    const first = focalZoomTransform({
      transform: ZOOM_IDENTITY,
      nextScale: 2,
      focalX: 220,
      focalY: 260,
      geometry: phone,
      ...surface,
    })
    const anchorX = 220 - surface.surfaceWidth / 2
    const anchorY = 260 - surface.surfaceHeight / 2
    const contentPointX = (anchorX - first.x) / first.scale
    const contentPointY = (anchorY - first.y) / first.scale
    const second = focalZoomTransform({
      transform: first,
      nextScale: 3,
      focalX: 220,
      focalY: 260,
      geometry: phone,
      ...surface,
    })
    expect((anchorX - second.x) / second.scale).toBeCloseTo(contentPointX, 6)
    expect((anchorY - second.y) / second.scale).toBeCloseTo(contentPointY, 6)
  })

  it("leaves the centre alone when the pinch is centred", () => {
    expect(
      focalZoomTransform({
        transform: ZOOM_IDENTITY,
        nextScale: 3,
        focalX: 150,
        focalY: 200,
        geometry: phone,
        ...surface,
      }),
    ).toEqual({ scale: 3, x: 0, y: 0 })
  })

  it("caps the scale and the resulting translation", () => {
    const next = focalZoomTransform({
      transform: ZOOM_IDENTITY,
      nextScale: 40,
      focalX: 300,
      focalY: 400,
      geometry: phone,
      ...surface,
    })
    expect(next.scale).toBe(LIGHTBOX_MAX_SCALE)
    expect(next.x).toBe(zoomTranslationLimits(LIGHTBOX_MAX_SCALE, phone).x * -1)
    expect(next.y).toBe(zoomTranslationLimits(LIGHTBOX_MAX_SCALE, phone).y * -1)
  })

  it("reads the focal against the surface it was measured in", () => {
    const fullScreen = focalZoomTransform({
      transform: ZOOM_IDENTITY,
      nextScale: 2,
      focalX: 390,
      focalY: 844,
      surfaceWidth: 390,
      surfaceHeight: 844,
      geometry: letterboxed,
    })
    expect(fullScreen.x).toBe(-zoomTranslationLimits(2, letterboxed).x)
    expect(fullScreen.y).toBe(0)
  })
})

describe("doubleTapZoomTransform", () => {
  const surface = { surfaceWidth: 300, surfaceHeight: 400 }

  it("zooms to the double-tap scale at the tapped point", () => {
    const next = doubleTapZoomTransform({
      transform: ZOOM_IDENTITY,
      focalX: 300,
      focalY: 400,
      geometry: phone,
      ...surface,
    })
    expect(next.scale).toBe(LIGHTBOX_DOUBLE_TAP_SCALE)
    expect(next.x).toBeLessThan(0)
    expect(next.y).toBeLessThan(0)
  })

  it("toggles straight back to fit when already zoomed", () => {
    expect(
      doubleTapZoomTransform({
        transform: { scale: 2, x: 100, y: 100 },
        focalX: 10,
        focalY: 10,
        geometry: phone,
        ...surface,
      }),
    ).toEqual(ZOOM_IDENTITY)
  })

  it("treats a barely-zoomed transform as unzoomed, so a double tap zooms IN", () => {
    const next = doubleTapZoomTransform({
      transform: { scale: LIGHTBOX_ZOOM_SNAP_SCALE, x: 0, y: 0 },
      focalX: 150,
      focalY: 200,
      geometry: phone,
      ...surface,
    })
    expect(next.scale).toBe(LIGHTBOX_DOUBLE_TAP_SCALE)
  })
})

describe("panZoomTransform", () => {
  it("adds the drag delta and clamps to the bounds", () => {
    expect(panZoomTransform({ scale: 2, x: 0, y: 0 }, 40, -60, phone)).toEqual({ scale: 2, x: 40, y: -60 })
    expect(panZoomTransform({ scale: 2, x: 140, y: 0 }, 40, 0, phone)).toEqual({ scale: 2, x: 150, y: 0 })
  })

  it("cannot move an unzoomed image", () => {
    expect(panZoomTransform(ZOOM_IDENTITY, 120, 120, phone)).toEqual(ZOOM_IDENTITY)
  })

  it("ignores a garbage delta", () => {
    expect(panZoomTransform({ scale: 2, x: 10, y: 10 }, Number.NaN, Number.NaN, phone)).toEqual({
      scale: 2,
      x: 10,
      y: 10,
    })
  })
})

describe("settleZoomTransform", () => {
  it("snaps back to fit from under the snap threshold", () => {
    expect(settleZoomTransform({ scale: 1.04, x: 30, y: 30 }, phone)).toEqual(ZOOM_IDENTITY)
    expect(settleZoomTransform({ scale: 0.4, x: 0, y: 0 }, phone)).toEqual(ZOOM_IDENTITY)
  })

  it("keeps a real zoom but pulls the gutters shut", () => {
    expect(settleZoomTransform({ scale: 2, x: 400, y: -400 }, phone)).toEqual({ scale: 2, x: 150, y: -200 })
  })
})

describe("wheelZoomScale", () => {
  it("zooms in on a scroll up and out on a scroll down", () => {
    expect(wheelZoomScale(1, -100)).toBeGreaterThan(1)
    expect(wheelZoomScale(2, 100)).toBeLessThan(2)
  })

  it("is monotone and bounded", () => {
    expect(wheelZoomScale(1, 100)).toBe(LIGHTBOX_MIN_SCALE)
    expect(wheelZoomScale(3.9, -10000)).toBe(LIGHTBOX_MAX_SCALE)
    expect(wheelZoomScale(2, -10, 2.5)).toBeLessThanOrEqual(2.5)
  })

  it("is stable at a zero delta", () => {
    expect(wheelZoomScale(2.25, 0)).toBe(2.25)
    expect(wheelZoomScale(2.25, Number.NaN)).toBe(2.25)
  })
})

describe("travelExceeds", () => {
  it("stays false inside the slop and true past it", () => {
    expect(travelExceeds({ x: 0, y: 0 }, { x: 8, y: 8 }, 12)).toBe(false)
    expect(travelExceeds({ x: 0, y: 0 }, { x: 12, y: 0 }, 12)).toBe(false)
    expect(travelExceeds({ x: 0, y: 0 }, { x: 13, y: 0 }, 12)).toBe(true)
    expect(travelExceeds({ x: 100, y: 100 }, { x: 100, y: 60 }, 12)).toBe(true)
  })

  it("treats garbage as no travel", () => {
    expect(travelExceeds({ x: Number.NaN, y: 0 }, { x: 0, y: 0 }, 12)).toBe(false)
    expect(travelExceeds({ x: 0, y: 0 }, { x: 5, y: 0 }, Number.NaN)).toBe(true)
    expect(travelExceeds({ x: 0, y: 0 }, { x: 0, y: 0 }, -5)).toBe(false)
  })
})

describe("pointer helpers", () => {
  it("measures the two-finger spread and midpoint", () => {
    expect(pointerDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
    expect(pointerMidpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 })
  })
})

describe("cssZoomTransform", () => {
  it("emits translate-then-scale, matching the native transform order", () => {
    expect(cssZoomTransform(ZOOM_IDENTITY)).toBe("translate3d(0px, 0px, 0) scale(1)")
    expect(cssZoomTransform({ scale: 2.5, x: -12.5, y: 8.126 })).toBe(
      "translate3d(-12.5px, 8.13px, 0) scale(2.5)",
    )
  })

  it("clamps a rogue scale before it reaches the DOM", () => {
    expect(cssZoomTransform({ scale: 99, x: 0, y: 0 })).toBe(
      `translate3d(0px, 0px, 0) scale(${LIGHTBOX_MAX_SCALE})`,
    )
  })
})

describe("zoomGeometry", () => {
  it("sanitizes every input", () => {
    expect(
      zoomGeometry({
        contentWidth: -10,
        contentHeight: Number.NaN,
        viewportWidth: 390,
        viewportHeight: 844,
      }),
    ).toEqual({
      contentWidth: 0,
      contentHeight: 0,
      viewportWidth: 390,
      viewportHeight: 844,
      maxScale: LIGHTBOX_MAX_SCALE,
    })
  })

  it("keeps maxScale inside the supported range", () => {
    expect(zoomGeometry({ ...phone, maxScale: 2 }).maxScale).toBe(2)
    expect(zoomGeometry({ ...phone, maxScale: 99 }).maxScale).toBe(LIGHTBOX_MAX_SCALE)
    expect(zoomGeometry({ ...phone, maxScale: 0.1 }).maxScale).toBe(LIGHTBOX_MIN_SCALE)
  })
})

describe("the zoom model stays callable from the UI thread", () => {
  const src = readFileSync(new URL("../lightboxZoom.ts", import.meta.url), "utf8")
  const WORKLET_CALLED = [
    "clampZoomScale",
    "isZoomed",
    "zoomTranslationLimits",
    "clampZoomTransform",
    "focalZoomTransform",
    "doubleTapZoomTransform",
    "panZoomTransform",
    "settleZoomTransform",
    "wheelZoomScale",
    "travelExceeds",
  ]

  it.each(WORKLET_CALLED)("declares %s as a worklet", (name) => {
    expect(src).toMatch(new RegExp(`function ${name}\\([\\s\\S]*?\\{\\n  "worklet"`))
  })

  it("keeps the helpers a gesture worklet reaches workletized too", () => {
    expect(src).toMatch(/function finite\(value: number, fallback: number\): number \{\n {2}"worklet"/)
    expect(src).toMatch(/function clampToLimit\(value: number, limit: number\): number \{\n {2}"worklet"/)
  })
})
