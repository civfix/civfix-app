import type { EventKind } from "@civfix/shared"
import {
  categoryColor,
  cleanupColorFor,
  colorSchemes,
  type ColorSchemeName,
} from "@civfix/shared/tokens"
import { contrastRatio } from "@civfix/shared/chip-contrast"
import { basemapPaper } from "../mapStyle"
import { DROP_PIN_GLYPH, PIN_GLYPHS, glyphForCategory } from "./glyphs"

/** WCAG 1.4.11 non-text contrast: a pin must read against the basemap, a glyph against its pin. */
export const PIN_NON_TEXT_CONTRAST = 3

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

export type ClusterTone = "reports" | "events"

export interface ClusterBubbleAppearance {
  fill: string
  label: string
}

export function clusterToneFor(reportCount: number, eventCount: number): ClusterTone {
  return reportCount <= 0 && eventCount > 0 ? "events" : "reports"
}

/** Whichever of the scheme's ink or `onAccent` reads better on `fill`, for a glyph, count or check. */
export function inkOnFill(fill: string, scheme: ColorSchemeName, onAccent: string): string {
  const ink = colorSchemes[scheme].neutral.ink
  return contrastRatio(ink, fill) >= contrastRatio(onAccent, fill) ? ink : onAccent
}

function pinFillsOf(scheme: ColorSchemeName): string[] {
  const { brand, category } = colorSchemes[scheme]
  return [
    ...Object.keys(category).map((key) => categoryColor(key, scheme)),
    cleanupColorFor(scheme),
    brand.bloom,
    brand.lilac,
  ]
}

/**
 * The pin body outline for a scheme, or null when every pin fill already clears the basemap on its own.
 * One outline for all pins in a scheme (not per fill) so the pin family keeps a single silhouette.
 */
export function pinOutlineFor(scheme: ColorSchemeName): string | null {
  const ground = basemapPaper(scheme)
  if (pinFillsOf(scheme).every((fill) => contrastRatio(fill, ground) >= PIN_NON_TEXT_CONTRAST)) return null
  const { ink, paper } = colorSchemes[scheme].neutral
  return contrastRatio(ink, ground) >= contrastRatio(paper, ground) ? ink : paper
}

export function clusterBubbleAppearance(
  tone: ClusterTone,
  scheme: ColorSchemeName,
  onAccent: string,
): ClusterBubbleAppearance {
  const fill =
    tone === "events"
      ? pinAppearanceFor(eventPinTarget("cleanup"), scheme).fill
      : colorSchemes[scheme].brand.bloom
  return { fill, label: inkOnFill(fill, scheme, onAccent) }
}
