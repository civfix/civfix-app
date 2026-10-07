/**
 * ScrollHost: the shell-injected scroll-container seam.
 *
 * A scrollable body needs a different scroll container depending on the shell it is mounted in, even on
 * the same platform: inside the native compact sheet its scroll must coordinate with the sheet drag, while
 * in the expanded panel and on web it must be a plain RN ScrollView / FlatList. A `.native` / `.web` file
 * seam cannot tell shells apart, so the shell injects the components through context and the body
 * consumes them. With no provider mounted the plain RN components are used, so a body works stand-alone.
 *
 * CompactShell.native adds the handoff, keyboard-aware and minimize-aware decorators (see its
 * SHEET_SCROLL_HOST); the web, expanded and portrait shells inject the keyboard-aware plain host. Because a
 * body owns its scroll through this host, the shells render every body raw in a flex:1 region and never
 * wrap it in a second ScrollView.
 *
 * Nested vertical scrollers: every decorator assumes the scrollable it wraps is the surface's main scroll
 * region. A body that renders a second vertical scroller inside the sheet must give it its own
 * `<ScrollHostProvider value={PLAIN_SCROLL_HOST}>`; otherwise pulling down inside it arms the sheet
 * handoff from its own offset 0 and collapses the whole sheet.
 *
 * Component props stay loose because the injected components do not share a single TS type; only the
 * list's imperative handle is named, and every decorator forwards its ref to the RN FlatList underneath.
 * This module must never import gorhom, so the shared body source stays gorhom-free (import-guard).
 *
 * @shopify/flash-list was assessed and deferred: gorhom's BottomSheetFlashList is self-deprecated and
 * written against flash-list v1, and the paginated lists are bounded enough for FlatList. A future swap
 * lands here as another `ScrollHostValue`, with no body change.
 */
import React, { createContext, useContext } from "react"
import {
  ScrollView as RNScrollView,
  FlatList as RNFlatList,
  type Insets,
  type NativeScrollEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native"

export interface ScrollHostValue {
  ScrollView: React.ComponentType<any>
  FlatList: React.ComponentType<ScrollHostListProps>
}

export interface ScrollHostListHandle {
  scrollToOffset?: (options: { offset: number; animated?: boolean }) => void
  scrollToEnd?: (options?: { animated?: boolean }) => void
}

export type ScrollHostListProps = Record<string, unknown> & {
  ref?: React.Ref<ScrollHostListHandle>
}

/**
 * The props a decorator reads; everything else is forwarded untouched. `onScroll` receives only
 * `{ nativeEvent }` because the reanimated handoff re-emits a worklet payload, not a full RN event.
 */
export interface DecoratedScrollProps {
  contentContainerStyle?: StyleProp<ViewStyle>
  horizontal?: boolean | null
  onScroll?: (event: { nativeEvent: NativeScrollEvent }) => void
  scrollEventThrottle?: number
  scrollIndicatorInsets?: Insets
}

const DEFAULT_SCROLL_HOST: ScrollHostValue = {
  ScrollView: RNScrollView as React.ComponentType<any>,
  FlatList: RNFlatList as unknown as React.ComponentType<ScrollHostListProps>,
}

const ScrollHostContext = createContext<ScrollHostValue>(DEFAULT_SCROLL_HOST)
ScrollHostContext.displayName = "ScrollHostContext"

export interface ScrollHostProviderProps {
  value: ScrollHostValue
  children: React.ReactNode
}

export function ScrollHostProvider({ value, children }: ScrollHostProviderProps) {
  return <ScrollHostContext.Provider value={value}>{children}</ScrollHostContext.Provider>
}

export function useScrollHost(): ScrollHostValue {
  return useContext(ScrollHostContext)
}

/** Exported so every shell that injects the plain host shares one identity. */
export const PLAIN_SCROLL_HOST = DEFAULT_SCROLL_HOST

export function decorateScrollHost(
  base: ScrollHostValue,
  wrap: (Base: React.ComponentType<any>) => React.ComponentType<any>,
): ScrollHostValue {
  return { ScrollView: wrap(base.ScrollView), FlatList: wrap(base.FlatList) }
}
