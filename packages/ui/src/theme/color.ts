import type { Theme } from "./themes"

/** `#rrggbb` gains an `aa` byte; any other color form passes through unchanged. */
export function hexWithAlpha(color: string, opacity: number): string {
  const a = Math.round(Math.min(Math.max(opacity, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0")
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${a}` : color
}

export function tint(hex: string, amount: number): string {
  const n = hex.replace("#", "")
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

function mixHex(hex: string, toward: string, amount: number): string {
  const a = hex.replace("#", "")
  const b = toward.replace("#", "")
  const ch = (v: string, i: number) => parseInt(v.slice(i, i + 2), 16)
  const mix = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * amount)
  return `rgb(${mix(0)}, ${mix(2)}, ${mix(4)})`
}

export function wash(hex: string, amount: number, theme: Theme): string {
  return theme.scheme === "dark" ? mixHex(hex, theme.colors.surface, amount) : tint(hex, amount)
}
