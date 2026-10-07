import React, { createContext, forwardRef, useContext, useMemo } from "react"
import { withExtraBottomPadding } from "./bottomPadding"
import { decorateScrollHost, type DecoratedScrollProps, type ScrollHostValue } from "./ScrollHost"

const ContentBottomReserveContext = createContext(0)
ContentBottomReserveContext.displayName = "ContentBottomReserveContext"

export const ContentBottomReserveProvider = ContentBottomReserveContext.Provider

function useContentBottomReserve(): number {
  return useContext(ContentBottomReserveContext)
}

function makeContentBottomReserveScroll(
  Base: React.ComponentType<any>,
  useReserve: () => number,
): React.ComponentType<any> {
  const ContentBottomReserveScroll = forwardRef<unknown, DecoratedScrollProps>(function ContentBottomReserveScroll(
    { contentContainerStyle, horizontal, ...rest },
    ref,
  ) {
    const reserve = useReserve()
    const mergedContentStyle = useMemo(() => {
      if (horizontal || reserve <= 0) return contentContainerStyle
      return withExtraBottomPadding(contentContainerStyle, reserve)
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
  return decorateScrollHost(base, (Base) => makeContentBottomReserveScroll(Base, useReserve))
}

const RESERVED_HOSTS = new WeakMap<ScrollHostValue, ScrollHostValue>()

export function contentBottomReserveScrollHost(base: ScrollHostValue): ScrollHostValue {
  const cached = RESERVED_HOSTS.get(base)
  if (cached) return cached
  const host = makeContentBottomReserveScrollHost(base)
  RESERVED_HOSTS.set(base, host)
  return host
}
