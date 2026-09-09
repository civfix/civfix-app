import { colorSchemes, type ColorSchemeName } from "./design-tokens.js"

export const MIN_CHIP_RATIO = 4.5

export const CHIP_HUE_NAMES = ["bloom", "moss", "sun", "sky", "lilac"] as const

export type ChipHueName = (typeof CHIP_HUE_NAMES)[number]

export interface ChipHuePair {
  name: ChipHueName
  text: string
  bg: string
  minRatio: number
}

function channels(hex: string): [number, number, number] {
  const raw = hex.replace("#", "")
  if (raw.length !== 6) throw new RangeError(`chip-contrast expects a 6-digit hex color, got "${hex}"`)
  const parts = [0, 2, 4].map((i) => {
    const value = parseInt(raw.slice(i, i + 2), 16)
    if (!Number.isFinite(value)) throw new RangeError(`chip-contrast expects a 6-digit hex color, got "${hex}"`)
    return value
  })
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const u = c / 255
    return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4)
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export function mixWithWhite(hex: string, amount: number): string {
  const weight = Math.min(1, Math.max(0, amount))
  const mixed = channels(hex).map((value) => Math.round(weight * value + (1 - weight) * 255))
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase()}`
}

export function chipHuePairs(scheme: ColorSchemeName): readonly ChipHuePair[] {
  const palette = colorSchemes[scheme]
  return CHIP_HUE_NAMES.map((name) => ({
    name,
    text: palette.chipInk[name],
    bg: palette[name]["50"],
    minRatio: MIN_CHIP_RATIO,
  }))
}

export function chipPairPasses(pair: ChipHuePair): boolean {
  return contrastRatio(pair.text, pair.bg) >= pair.minRatio
}
