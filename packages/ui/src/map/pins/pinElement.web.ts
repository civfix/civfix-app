import { tokens, shadowSchemes } from "@civfix/shared/tokens"
import type { Theme } from "../../theme"

export function applyPinElementTheme(el: HTMLElement, t: Theme, fill: string): void {
  el.style.background = fill
  el.style.boxShadow = shadowSchemes[t.scheme].pin
  el.style.border = `2px solid ${t.colors.onAccent}`
}

export function makePinElement(t: Theme, fill: string): HTMLDivElement {
  const el = document.createElement("div")
  el.style.width = "24px"
  el.style.height = "24px"
  el.style.borderRadius = String(tokens.radius.pin)
  el.style.transform = "rotate(45deg)"
  el.style.boxSizing = "border-box"
  el.style.cursor = "grab"
  applyPinElementTheme(el, t, fill)
  return el
}
