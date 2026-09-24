import { useEffect, useRef, useState } from "react"
import { Animated, Easing, Platform } from "react-native"
import { motion, type TimingRecipe } from "../theme"
import { useReducedMotion } from "../theme/useReducedMotion"
import { MENU_SCALE_FROM, menuOrigin, type MenuOrigin } from "./menuMotionModel"

export { MENU_SCALE_FROM, menuOrigin }
export type { MenuAnchorRect, MenuCardRect, MenuOrigin } from "./menuMotionModel"

declare const process: { env: { NODE_ENV?: string } }

const MENU_NATIVE_DRIVER = Platform.OS !== "web"

const MENU_MOTION_DEV_ASSERTS = process.env.NODE_ENV !== "production"

export interface MenuMotion {
  rendered: boolean
  exiting: boolean
  reducedMotion: boolean
  progress: Animated.Value
  useNativeDriver: boolean
}

export interface MenuMotionRecipes {
  enter: TimingRecipe
  exit: TimingRecipe
}

export const MENU_RECIPES: MenuMotionRecipes = { enter: motion.menuIn, exit: motion.menuOut }

export function useMenuMotion({
  visible,
  ready = true,
  reducedMotion: reducedMotionOverride,
  useNativeDriver = MENU_NATIVE_DRIVER,
  recipes = MENU_RECIPES,
}: {
  visible: boolean
  ready?: boolean
  reducedMotion?: boolean
  useNativeDriver?: boolean
  recipes?: MenuMotionRecipes
}): MenuMotion {
  const systemReducedMotion = useReducedMotion() === true
  const reducedMotion = reducedMotionOverride ?? systemReducedMotion
  const progress = useRef(new Animated.Value(0)).current
  const [rendered, setRendered] = useState(visible)
  const [exiting, setExiting] = useState(false)
  const renderedRef = useRef(visible)
  const animRef = useRef<Animated.CompositeAnimation | null>(null)
  const recipesRef = useRef(recipes)
  if (MENU_MOTION_DEV_ASSERTS && recipesRef.current !== recipes) {
    throw new Error(
      "useMenuMotion recipes must keep one object identity: a running timing reads them through a ref, so a swapped recipe is silently ignored. Hoist them to a module constant.",
    )
  }
  recipesRef.current = recipes

  useEffect(() => {
    const recipes = recipesRef.current
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
        duration: recipes.enter.duration,
        easing: Easing.bezier(...recipes.enter.easing),
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
      duration: recipes.exit.duration,
      easing: Easing.bezier(...recipes.exit.easing),
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
