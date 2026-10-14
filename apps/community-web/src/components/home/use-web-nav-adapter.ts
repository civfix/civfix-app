"use client"

import * as React from "react"
import { useNavStore } from "@civfix/ui"

import { createWebNavController } from "./web-nav-controller"

function lastFocusable(selector: string): Element | undefined {
  return Array.from(document.querySelectorAll(selector))
    .filter((element) => !element.closest('[aria-hidden="true"], [inert]'))
    .pop()
}

export function useWebNavAdapter(): void {
  const [controller] = React.useState(createWebNavController)

  React.useLayoutEffect(() => {
    controller.mount()
  }, [controller])

  React.useEffect(() => controller.followStore(), [controller])

  React.useEffect(() => controller.followHistory(), [controller])

  // Focus moves to the new panel's heading on route change (WCAG 2.4.3), after a frame so the panel has
  // rendered. The subscriber also fires on search keystrokes (`query` lives in the same store), so it
  // gates on the active entry changing; otherwise typing with a detail panel open would lose focus.
  React.useEffect(() => {
    let prevActive = useNavStore.getState().active
    const unsub = useNavStore.subscribe((state) => {
      const active = state.active
      if (active === prevActive) return
      prevActive = active
      if (typeof window === "undefined") return
      if (active) {
        requestAnimationFrame(() => {
          const target =
            lastFocusable("[data-civfix-panel-heading]") ?? lastFocusable("[data-civfix-page-layer]")
          if (target instanceof HTMLElement) target.focus({ preventScroll: true })
        })
      }
    })
    return unsub
  }, [])
}
