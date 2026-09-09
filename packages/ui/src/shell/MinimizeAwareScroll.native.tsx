import React, { forwardRef, useCallback, useEffect, useRef } from "react"
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native"
import type { ScrollHostValue } from "./ScrollHost"
import { useDockMinimizeStore } from "./dockMinimizeStore"
import { useNavStore } from "../nav"

let dockScrollOwner: object | null = null

function claimDockScroll(token: object): boolean {
  if (dockScrollOwner === null) dockScrollOwner = token
  return dockScrollOwner === token
}

const minimizeState = useDockMinimizeStore.getState
const navState = useNavStore.getState

let publishScroll: ((y: number, suppressed?: boolean) => void) | null = null

function makeMinimizeAwareScroll(Base: React.ComponentType<any>): React.ComponentType<any> {
  const MinimizeAwareScroll = forwardRef<any, any>(function MinimizeAwareScroll(
    { onScroll, scrollEventThrottle, horizontal, ...rest },
    ref,
  ) {
    const tokenRef = useRef<object>({})
    const ownsRef = useRef(false)

    useEffect(() => {
      if (horizontal) return
      const token = tokenRef.current
      const owns = claimDockScroll(token)
      ownsRef.current = owns
      if (owns) minimizeState().reset()
      return () => {
        ownsRef.current = false
        if (dockScrollOwner !== token) return
        dockScrollOwner = null
        minimizeState().reset()
      }
    }, [horizontal])

    const handleScroll = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (!horizontal) {
          const owns = ownsRef.current || (dockScrollOwner === null && claimDockScroll(tokenRef.current))
          if (owns) {
            ownsRef.current = true
            const y = e.nativeEvent.contentOffset.y
            const suppressed = navState().view === "search"
            if (publishScroll === null) publishScroll = minimizeState().handleScroll
            publishScroll(y, suppressed)
          }
        }
        onScroll?.(e)
      },
      [onScroll, horizontal],
    )

    return (
      <Base
        ref={ref}
        horizontal={horizontal}
        onScroll={handleScroll}
        scrollEventThrottle={scrollEventThrottle ?? 16}
        {...rest}
      />
    )
  })
  MinimizeAwareScroll.displayName = "MinimizeAwareScroll"
  return MinimizeAwareScroll as unknown as React.ComponentType<any>
}

export function makeMinimizeAwareScrollHost(base: ScrollHostValue): ScrollHostValue {
  return {
    ScrollView: makeMinimizeAwareScroll(base.ScrollView),
    FlatList: makeMinimizeAwareScroll(base.FlatList),
  }
}
