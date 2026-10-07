import React, { createContext, forwardRef, useContext, useEffect, useMemo, useState } from "react"
import { StyleSheet } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated"
import { makeThemedStyles } from "../theme"
import { searchRevealExitStyle, searchRevealStyle } from "./bodyLayout"
import { withExtraBottomPadding } from "./bottomPadding"
import { dockMorphProgress } from "./dockMorphProgress.native"
import { makeKeyboardAwareScrollHost } from "./KeyboardAwareScroll"
import {
  PLAIN_SCROLL_HOST,
  ScrollHostProvider,
  decorateScrollHost,
  type DecoratedScrollProps,
  type ScrollHostValue,
} from "./ScrollHost"
import { useSearchBarStore } from "./searchBarStore"
import { resolveTabBarFootprint } from "./tabBarLogic"
import { useTabBarStore } from "./tabBarStore"
import type { SearchBodyRevealProps } from "./SearchBodyReveal.types"

const DockClearanceFallbackContext = createContext(0)
DockClearanceFallbackContext.displayName = "DockClearanceFallbackContext"

function makeDockClearanceScroll(Base: React.ComponentType<any>): React.ComponentType<any> {
  const DockClearanceScroll = forwardRef<unknown, DecoratedScrollProps>(function DockClearanceScroll(
    { contentContainerStyle, horizontal, scrollIndicatorInsets, ...rest },
    ref,
  ) {
    const footprint = useTabBarStore((s) => s.tabBarHeight)
    const keyboardReserve = useSearchBarStore((s) => s.keyboardReserve)
    const fallback = useContext(DockClearanceFallbackContext)
    const clearance = horizontal ? 0 : resolveTabBarFootprint(footprint, fallback) + keyboardReserve

    const mergedContentStyle = useMemo(
      () => withExtraBottomPadding(contentContainerStyle, clearance),
      [contentContainerStyle, clearance],
    )

    const indicatorInsets = useMemo(
      () => scrollIndicatorInsets ?? { bottom: clearance },
      [scrollIndicatorInsets, clearance],
    )

    return (
      <Base
        ref={ref}
        contentContainerStyle={mergedContentStyle}
        horizontal={horizontal}
        scrollIndicatorInsets={indicatorInsets}
        {...rest}
      />
    )
  })
  DockClearanceScroll.displayName = "DockClearanceScroll"
  return DockClearanceScroll as unknown as React.ComponentType<any>
}

function makeDockClearanceScrollHost(base: ScrollHostValue): ScrollHostValue {
  return decorateScrollHost(base, makeDockClearanceScroll)
}

const PORTRAIT_SCROLL_HOST = makeDockClearanceScrollHost(
  makeKeyboardAwareScrollHost(PLAIN_SCROLL_HOST, {
    ownsFocusedInput: false,
    reserveKeyboardPadding: false,
  }),
)

export function SearchBodyReveal({ active, renderBody, topInset, bottomInset }: SearchBodyRevealProps) {
  const styles = useStyles()
  const [mounted, setMounted] = useState(active)
  useEffect(() => {
    if (active) setMounted(true)
  }, [active])

  const entering = useSharedValue(active ? 1 : 0)
  useEffect(() => {
    entering.value = active ? 1 : 0
  }, [active, entering])

  const revealStyle = useAnimatedStyle(() => {
    const p = dockMorphProgress.value
    const { opacity, translateY } = entering.value ? searchRevealStyle(p) : searchRevealExitStyle(p)
    return { opacity, transform: [{ translateY }] }
  })

  const body = useMemo(() => renderBody(null, "search"), [renderBody])

  if (!mounted) return null

  return (
    <Animated.View
      style={[styles.layer, { paddingTop: topInset }, revealStyle]}
      pointerEvents={active ? "auto" : "none"}
    >
      <DockClearanceFallbackContext.Provider value={bottomInset}>
        <ScrollHostProvider value={PORTRAIT_SCROLL_HOST}>
          {body}
        </ScrollHostProvider>
      </DockClearanceFallbackContext.Provider>
    </Animated.View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 55,
    overflow: "hidden",
    backgroundColor: t.colors.bg,
  },
}))
