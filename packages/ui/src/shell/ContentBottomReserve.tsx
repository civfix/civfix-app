import React, { createContext, forwardRef, useContext, useMemo } from "react"
import { StyleSheet } from "react-native"
import type { ScrollHostValue } from "./ScrollHost"

const ContentBottomReserveContext = createContext(0)
ContentBottomReserveContext.displayName = "ContentBottomReserveContext"

export const ContentBottomReserveProvider = ContentBottomReserveContext.Provider

export function useContentBottomReserve(): number {
  return useContext(ContentBottomReserveContext)
}

function makeContentBottomReserveScroll(
  Base: React.ComponentType<any>,
  useReserve: () => number,
): React.ComponentType<any> {
  const ContentBottomReserveScroll = forwardRef<any, any>(function ContentBottomReserveScroll(
    { contentContainerStyle, horizontal, ...rest },
    ref,
  ) {
    const reserve = useReserve()
    const mergedContentStyle = useMemo(() => {
      if (horizontal || reserve <= 0) return contentContainerStyle
      const flat = (StyleSheet.flatten(contentContainerStyle) || {}) as { paddingBottom?: number }
      const basePad = typeof flat.paddingBottom === "number" ? flat.paddingBottom : 0
      return [contentContainerStyle, { paddingBottom: basePad + reserve }]
    }, [contentContainerStyle, horizontal, reserve])
    return (
      <Base ref={ref} contentContainerStyle={mergedContentStyle} horizontal={horizontal} {...rest} />
    )
  })
  ContentBottomReserveScroll.displayName = "ContentBottomReserveScroll"
  return ContentBottomReserveScroll as unknown as React.ComponentType<any>
}

export function makeContentBottomReserveScrollHost(
  base: ScrollHostValue,
  useReserve: () => number = useContentBottomReserve,
): ScrollHostValue {
  return {
    ScrollView: makeContentBottomReserveScroll(base.ScrollView, useReserve),
    FlatList: makeContentBottomReserveScroll(base.FlatList, useReserve),
  }
}

const RESERVED_HOSTS = new WeakMap<ScrollHostValue, ScrollHostValue>()

export function contentBottomReserveScrollHost(base: ScrollHostValue): ScrollHostValue {
  const cached = RESERVED_HOSTS.get(base)
  if (cached) return cached
  const host = makeContentBottomReserveScrollHost(base)
  RESERVED_HOSTS.set(base, host)
  return host
}
