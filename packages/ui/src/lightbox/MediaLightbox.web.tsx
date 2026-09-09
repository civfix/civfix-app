/**
 * MediaLightbox (web seam) - the full-screen media viewer on web (react-native-web).
 *
 * The viewer itself lives in the shared <MediaLightboxBase> (hosted in an RNW-safe RN <Modal>, which on
 * react-native-web becomes a `position: fixed` layer that escapes every parent overflow/stacking context).
 * This seam adds the WEB-only deltas:
 *   - a window "keydown" listener while visible: Escape -> close, ArrowRight -> next, ArrowLeft -> prev.
 *     All DOM/window access is guarded with `typeof window !== "undefined"` so the SSR (Next) bundle never
 *     touches `window`. The handler reads the live index/count through a ref, so paging does NOT tear down
 *     and re-add the listener on every step.
 *   - `aria-modal` on the content container for assistive tech.
 */
import React, { useCallback, useEffect, useRef } from "react"
import { MediaLightboxBase } from "./MediaLightboxBase"
import type { MediaLightboxViewProps } from "./MediaLightboxBase"

export type { MediaLightboxViewProps }

export function MediaLightboxView(props: MediaLightboxViewProps) {
  const { visible, items, index, onIndexChange, onClose } = props

  // The keydown handler reads the CURRENT nav state from this ref, so the effect below subscribes once
  // per open instead of re-subscribing on every index change.
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
