import { useEffect, useRef, useState } from "react"
import { Animated, Easing, Platform } from "react-native"
import { motion } from "../theme"
import { useReducedMotion } from "../theme/useReducedMotion"
import { MENU_SCALE_FROM, menuOrigin, type MenuOrigin } from "./menuMotionModel"

export { MENU_SCALE_FROM, menuOrigin }
export type { MenuAnchorRect, MenuCardRect, MenuOrigin } from "./menuMotionModel"

export const MENU_NATIVE_DRIVER = Platform.OS !== "web"

export interface MenuMotion {
  rendered: boolean
  exiting: boolean
  reducedMotion: boolean
  progress: Animated.Value
  useNativeDriver: boolean
}

export function useMenuMotion({
  visible,
  ready = true,
  reducedMotion: reducedMotionOverride,
  useNativeDriver = MENU_NATIVE_DRIVER,
}: {
  visible: boolean
  ready?: boolean
  reducedMotion?: boolean
  useNativeDriver?: boolean
}): MenuMotion {
  const systemReducedMotion = useReducedMotion() === true
  const reducedMotion = reducedMotionOverride ?? systemReducedMotion
  const progress = useRef(new Animated.Value(0)).current
  const [rendered, setRendered] = useState(visible)
  const [exiting, setExiting] = useState(false)
  const renderedRef = useRef(visible)
  const animRef = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    animRef.current?.stop()
    animRef.current = null
    if (visible) {
      renderedRef.current = true
      setRendered(true)
      setExiting(false)
      if (!ready) return
      if (reducedMotion) {
        progress.setValue(1)
        return
      }
      const enter = Animated.timing(progress, {
        toValue: 1,
        duration: motion.menuIn.duration,
        easing: Easing.bezier(...motion.menuIn.easing),
        useNativeDriver,
      })
      animRef.current = enter
      enter.start()
      return
    }
    if (!renderedRef.current) return
    if (reducedMotion) {
      progress.setValue(0)
      renderedRef.current = false
      setExiting(false)
      setRendered(false)
      return
    }
    setExiting(true)
    const exit = Animated.timing(progress, {
      toValue: 0,
      duration: motion.menuOut.duration,
      easing: Easing.bezier(...motion.menuOut.easing),
      useNativeDriver,
    })
    animRef.current = exit
    exit.start(({ finished }) => {
      if (!finished) return
      renderedRef.current = false
      setExiting(false)
      setRendered(false)
    })
  }, [visible, ready, reducedMotion, useNativeDriver, progress])

  useEffect(
    () => () => {
      animRef.current?.stop()
      animRef.current = null
    },
    [],
  )

  return { rendered, exiting, reducedMotion, progress, useNativeDriver }
}

export function menuCardStyle(motion: MenuMotion, origin: MenuOrigin) {
  if (motion.reducedMotion) return { opacity: motion.progress }
  const { progress } = motion
  return {
    opacity: progress,
    transform: [
      { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [origin.translateX, 0] }) },
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [origin.translateY, 0] }) },
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [MENU_SCALE_FROM, 1] }) },
    ],
  }
}

export function menuScrimStyle(motion: MenuMotion) {
  return { opacity: motion.progress }
}
