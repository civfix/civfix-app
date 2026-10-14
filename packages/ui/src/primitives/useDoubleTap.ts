import { useCallback, useEffect, useRef } from "react"

export const DOUBLE_TAP_WINDOW_MS = 280

export interface DoubleTapOptions {
  onSingleTap?: () => void
  onDoubleTap?: () => void
  windowMs?: number
}

export interface TapController {
  tap: () => void
  cancel: () => void
}

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
      cancel()
      onSingleTap?.()
      return
    }
    if (cooldown != null) {
      // The post-double cooldown swallows tap spam so it never leaks a stray delayed single.
      return
    }
    if (pending != null) {
      clearTimeout(pending)
      pending = null
      onDoubleTap()
      cooldown = setTimeout(() => {
        cooldown = null
      }, windowMs)
      return
    }
    pending = setTimeout(() => {
      pending = null
      getOptions().onSingleTap?.()
    }, windowMs)
  }

  return { tap, cancel }
}

export function useDoubleTap(options: DoubleTapOptions): { onPress: () => void } {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const controllerRef = useRef<TapController | null>(null)
  if (controllerRef.current == null) {
    controllerRef.current = createTapController(() => optionsRef.current)
  }

  useEffect(() => {
    const controller = controllerRef.current
    return () => controller?.cancel()
  }, [])

  const onPress = useCallback(() => {
    controllerRef.current?.tap()
  }, [])

  return { onPress }
}
