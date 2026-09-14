import type { EventKind } from "@civfix/shared"
import {
  categoryColor,
  cleanupColorFor,
  colorSchemes,
  type ColorSchemeName,
} from "@civfix/shared/tokens"
import { DROP_PIN_GLYPH, PIN_GLYPHS, glyphForCategory } from "./glyphs"

export type PinTarget =
  | { kind: "event"; eventKind: EventKind }
  | { kind: "report"; category: string | null }

export interface PinAppearance {
  fill: string
  glyph: string
}

export function eventPinTarget(eventKind: EventKind): PinTarget {
  return { kind: "event", eventKind }
}

export function reportPinTarget(category: string | null | undefined): PinTarget {
  return { kind: "report", category: category ?? null }
}

export function pinAppearanceFor(target: PinTarget, scheme: ColorSchemeName): PinAppearance {
  if (target.kind === "event") {
    if (target.eventKind === "other_volunteer") {
      return { fill: colorSchemes[scheme].brand.lilac, glyph: PIN_GLYPHS.other_volunteer! }
    }
    return { fill: cleanupColorFor(scheme), glyph: PIN_GLYPHS.cleanup! }
  }
  if (!target.category) {
    return { fill: colorSchemes[scheme].brand.bloom, glyph: DROP_PIN_GLYPH }
  }
  return { fill: categoryColor(target.category, scheme), glyph: glyphForCategory(target.category) }
}
