import type { EventKind } from "@civfix/shared"
import {
  categoryColor,
  cleanupColorFor,
  colorSchemes,
  type ColorSchemeName,
} from "@civfix/shared/tokens"
import { contrastRatio } from "@civfix/shared/chip-contrast"
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

export type ClusterTone = "reports" | "events"

export interface ClusterBubbleAppearance {
  fill: string
  label: string
}

export function clusterToneFor(reportCount: number, eventCount: number): ClusterTone {
  return reportCount <= 0 && eventCount > 0 ? "events" : "reports"
}

export function clusterBubbleAppearance(
  tone: ClusterTone,
  scheme: ColorSchemeName,
  onAccent: string,
): ClusterBubbleAppearance {
  if (tone !== "events") return { fill: colorSchemes[scheme].brand.bloom, label: onAccent }
  const fill = pinAppearanceFor(eventPinTarget("cleanup"), scheme).fill
  const ink = colorSchemes[scheme].neutral.ink
  return {
    fill,
    label: contrastRatio(ink, fill) >= contrastRatio(onAccent, fill) ? ink : onAccent,
  }
}
