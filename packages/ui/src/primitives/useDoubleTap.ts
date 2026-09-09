/**
 * useDoubleTap (P1 Task 1.2) - a Pressable-based double-tap timing helper with NO gesture-handler
 * dependency. Wraps a plain `onPress`: two taps landing within `windowMs` (default 280ms) fire
 * `onDoubleTap` and SUPPRESS the single-tap action; otherwise the single tap fires after the window
 * passes (delayed so a second tap can still upgrade it). When no `onDoubleTap` is provided the single
 * tap fires immediately - no artificial latency for plain-press consumers. After a double-tap fires,
 * further taps are SWALLOWED for one window (post-double cooldown): rapid tap spam maps to double-taps
 * only and can never leak a stray delayed single (a bare triple-tap = one double, nothing else).
 *
 * Built for the chat Bubble (Task 1.5: double-tap = quick "like" reaction, single tap keeps its
 * default). The timing logic lives in `createTapController`, a pure factory tested with fake timers
 * and no renderer (package convention: pure-logic vitest); the hook is a thin React wrapper that keeps
 * the latest callbacks in a ref and clears any pending timer on unmount.
 */
import { useCallback, useEffect, useRef } from "react"

/** Default max gap between two taps for them to count as a double-tap. */
export const DOUBLE_TAP_WINDOW_MS = 280

export interface DoubleTapOptions {
  /** The plain press action. Delayed by the window while a double-tap is possible. */
  onSingleTap?: () => void
  /** Fired instead of `onSingleTap` when a second tap lands within the window. */
  onDoubleTap?: () => void
  /** Max gap between taps to count as a double-tap. Defaults to DOUBLE_TAP_WINDOW_MS. */
  windowMs?: number
}

export interface TapController {
  /** Register one tap (wire to Pressable onPress). */
  tap: () => void
  /** Clear any pending delayed single-tap and post-double cooldown (unmount cleanup). */
  cancel: () => void
}

/**
 * The pure timing core. `getOptions` is read at tap time so callers (the hook) can swap callbacks per
 * render without resetting an in-flight window. Uses global setTimeout/clearTimeout - fake-timer
 * friendly, no React.
 */
export function createTapController(getOptions: () => DoubleTapOptions): TapController {
  let pending: ReturnType<typeof setTimeout> | null = null
  let cooldown: ReturnType<typeof setTimeout> | null = null

  const cancel = () => {
    if (pending != null) {
      clearTimeout(pending)
      pending = null
    }
    if (cooldown != null) {
      clearTimeout(cooldown)
      cooldown = null
    }
  }

  const tap = () => {
    const { onSingleTap, onDoubleTap, windowMs = DOUBLE_TAP_WINDOW_MS } = getOptions()
    if (!onDoubleTap) {
      // No double-tap consumer: behave like a plain onPress.
      cancel()
      onSingleTap?.()
      return
    }
    if (cooldown != null) {
      // Post-double cooldown: swallow tap spam so a triple-tap never queues a stray single.
      return
    }
    if (pending != null) {
      // Second tap inside the window: upgrade to a double-tap, suppress the queued single, and
      // swallow further taps for one window.
      clearTimeout(pending)
      pending = null
      onDoubleTap()
      cooldown = setTimeout(() => {
        cooldown = null
      }, windowMs)
      return
    }
    // First tap: hold the single-tap until the window closes (re-read options at fire time).
    pending = setTimeout(() => {
      pending = null
      getOptions().onSingleTap?.()
    }, windowMs)
  }

  return { tap, cancel }
}

/**
 * The hook: `const { onPress } = useDoubleTap({ onSingleTap, onDoubleTap })` then spread onto a
 * Pressable. `onPress` is referentially stable; the latest callbacks/window are always honored.
 */
export function useDoubleTap(options: DoubleTapOptions): { onPress: () => void } {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const controllerRef = useRef<TapController | null>(null)
  if (controllerRef.current == null) {
    controllerRef.current = createTapController(() => optionsRef.current)
  }

  // Unmount cleanup: never fire a delayed single-tap into an unmounted component.
  useEffect(() => {
    const controller = controllerRef.current
    return () => controller?.cancel()
  }, [])

  const onPress = useCallback(() => {
    controllerRef.current?.tap()
  }, [])

  return { onPress }
}
