/**
 * Issue #115 - "Wrong icon during report": the pin-drop map showed the EVENT pin (the gold calendar
 * teardrop) while the reporter was placing a dump report, and only turned into the report's own marker
 * once the report existed on the map.
 *
 * The cause was an implicit default. `LocationPickerProps.markerCategory` was OPTIONAL and "omitted"
 * meant "draw the event pin", so the report wizard - which never passed it - silently inherited the
 * host-an-event appearance. This suite pins the replacement: ONE derivation shared by the picker and by
 * the map's own markers, driven by a REQUIRED `pin` target, so "what am I placing" can no longer be left
 * unanswered and default to the wrong answer.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { cleanupColorFor, categoryColor, colorSchemes } from "@civfix/shared/tokens"
import {
  pinAppearanceFor,
  eventPinTarget,
  reportPinTarget,
} from "../pins/appearance"
import { DROP_PIN_GLYPH, PIN_GLYPHS, glyphForCategory } from "../pins/glyphs"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

describe("a report target never yields the event glyph", () => {
  it("draws the picked category's own teardrop, in both schemes", () => {
    for (const scheme of ["light", "dark"] as const) {
      for (const category of ["trash", "graffiti", "hazard", "water", "encampment", "recycling"]) {
        const pin = pinAppearanceFor(reportPinTarget(category), scheme)
        expect(pin.glyph).toBe(glyphForCategory(category))
        expect(pin.fill).toBe(categoryColor(category, scheme))
        expect(pin.glyph).not.toBe(PIN_GLYPHS.cleanup)
        expect(pin.fill).not.toBe(cleanupColorFor(scheme))
      }
    }
  })

  it("falls back to the NEUTRAL drop pin - never the calendar - when no category is chosen yet", () => {
    for (const scheme of ["light", "dark"] as const) {
      for (const target of [reportPinTarget(null), reportPinTarget(undefined), reportPinTarget("")]) {
        const pin = pinAppearanceFor(target, scheme)
        expect(pin.glyph).toBe(DROP_PIN_GLYPH)
        expect(pin.glyph).not.toBe(PIN_GLYPHS.cleanup)
        expect(pin.fill).toBe(colorSchemes[scheme].brand.bloom)
      }
    }
  })

  it("an unknown category still resolves to a report glyph, not the event one", () => {
    const pin = pinAppearanceFor(reportPinTarget("no-such-category"), "light")
    expect(pin.glyph).toBe(PIN_GLYPHS.trash)
    expect(pin.fill).toBe(categoryColor("other", "light"))
  })
})

describe("an event target keeps the marker the event actually gets on the map", () => {
  it("matches EventPin's own kind mapping in both schemes", () => {
    for (const scheme of ["light", "dark"] as const) {
      const cleanup = pinAppearanceFor(eventPinTarget("cleanup"), scheme)
      expect(cleanup).toEqual({ fill: cleanupColorFor(scheme), glyph: PIN_GLYPHS.cleanup })

      const volunteer = pinAppearanceFor(eventPinTarget("other_volunteer"), scheme)
      expect(volunteer).toEqual({
        fill: colorSchemes[scheme].brand.lilac,
        glyph: PIN_GLYPHS.other_volunteer,
      })
    }
  })
})

describe("the picker cannot silently inherit the event pin again (source-pinned)", () => {
  const pickerTypes = read("../LocationPicker.types.ts")
  const pickStepTypes = read("../PortraitMapPickStep.types.ts")
  const nativePicker = read("../LocationPicker.native.tsx")
  const wizard = read("../../bodies/ReportFlowBody.tsx")
  const cleanupForm = read("../../bodies/CleanupForm.tsx")

  it("both picker contracts take a REQUIRED pin target, with the optional category gone", () => {
    expect(pickerTypes).toContain("pin: PinTarget")
    expect(pickStepTypes).toContain("pin: PinTarget")
    expect(code(pickerTypes)).not.toContain("markerCategory")
    expect(code(pickStepTypes)).not.toContain("markerCategory")
  })

  it("the native seam renders ONE appearance rather than branching on a missing prop", () => {
    expect(nativePicker).toContain("pinAppearanceFor(pin, th.scheme)")
    expect(nativePicker).toContain("<PinSvg fill={pinAppearance.fill} glyph={pinAppearance.glyph}")
    expect(code(nativePicker)).not.toContain("PIN_GLYPHS.cleanup")
  })

  it("the report wizard hands BOTH of its pickers the picked category, live", () => {
    expect(wizard).toContain("const pin = useMemo(() => reportPinTarget(category), [category])")
    expect(wizard).toContain(
      "const pickPin = useMemo(() => reportPinTarget(draftCategory), [draftCategory])",
    )
    expect(wizard).toContain("pin={pin}")
    expect(wizard).toContain("pin={pickPin}")
  })

  it("the host-an-event form keeps the event appearance, now stated rather than defaulted", () => {
    expect(cleanupForm).toContain(
      "const pin = useMemo(() => eventPinTarget(value.eventKind), [value.eventKind])",
    )
    expect(cleanupForm).toContain("pin={pin}")
  })
})
