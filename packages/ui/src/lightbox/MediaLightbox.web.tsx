/**
 * RN's <Modal> becomes a `position: fixed` layer on react-native-web, escaping every parent overflow and
 * stacking context. This seam adds the web keys (Escape, ArrowLeft, ArrowRight) and `aria-modal`; every
 * window access is guarded so the static-export build never touches `window`.
 */
import React, { useCallback, useEffect, useRef } from "react"
import { MediaLightboxBase } from "./MediaLightboxBase"
import type { MediaLightboxViewProps } from "./MediaLightboxBase"

export type { MediaLightboxViewProps }

export function MediaLightboxView(props: MediaLightboxViewProps) {
  const { visible, items, index, onIndexChange, onClose } = props

  // Read through a ref so the listener subscribes once per open, not on every index change.
  const navRef = useRef({ count: items.length, index, onIndexChange, onClose })
  navRef.current = { count: items.length, index, onIndexChange, onClose }

  const step = useCallback((delta: number) => {
    const { count, index: i, onIndexChange: change } = navRef.current
    if (count < 2) return
    change((i + delta + count) % count)
  }, [])

  useEffect(() => {
    if (!visible) return
    if (typeof window === "undefined") return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        navRef.current.onClose()
      } else if (e.key === "ArrowRight") {
        step(1)
      } else if (e.key === "ArrowLeft") {
        step(-1)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [visible, step])

  return <MediaLightboxBase {...props} rootProps={{ "aria-modal": true }} />
}
