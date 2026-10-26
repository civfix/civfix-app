import { useEffect, type RefObject } from "react"
import type { View, ViewStyle } from "react-native"

/**
 * Fixed to the viewport, so it covers every route, the long legal pages too. 200 is community-web's
 * first-run gate layer: above the shell and the app-download banner, below the session alert (a failed
 * sign-out reports there and must stay reachable from a blocking gate) and the boot splash.
 */
export const LEGAL_GATE_LAYER = {
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  zIndex: 200,
} as unknown as ViewStyle

// community-web marks the session-alert layer with this attribute; a notice already on it keeps its retry.
const SESSION_ALERT_ATTR = "data-session-alert"

/** aria-modal alone doesn't stop Tab reaching the page behind, so everything outside the gate goes inert. */
export function useContainOutside(ref: RefObject<View | null>): void {
  useEffect(() => {
    const gate = ref.current as unknown as HTMLElement | null
    if (!gate) return
    const changed: Element[] = []
    let node: HTMLElement | null = gate
    while (node && node !== document.body) {
      const parent: HTMLElement | null = node.parentElement
      if (!parent) break
      for (const sibling of Array.from(parent.children)) {
        if (sibling === node || sibling.hasAttribute("inert") || sibling.hasAttribute(SESSION_ALERT_ATTR)) continue
        sibling.setAttribute("inert", "")
        changed.push(sibling)
      }
      node = parent
    }
    return () => {
      for (const sibling of changed) sibling.removeAttribute("inert")
    }
  }, [ref])
}
