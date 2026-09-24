import React, {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Dimensions,
  Keyboard,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import { motion } from "../theme"
import type { ScrollHostValue } from "./ScrollHost"
import { withExtraBottomPadding } from "./bottomPadding"
import { resolveHostFlag, type KeyboardAwareScrollHostOptions } from "./KeyboardAwareScroll.types"
import { keyboardFocusStore } from "./keyboardFocusStore"
import {
  KEYBOARD_REVEAL_MARGIN,
  keyboardTopInWindow,
  keyboardViewportOverlap,
  revealScrollDelta,
  revealScrollTarget,
} from "./keyboardInsetModel"
import {
  initialScrollKeyboardState,
  reduceScrollKeyboard,
  scrollKeyboardReveals,
  type ScrollKeyboardSignal,
} from "./keyboardScrollModel"
import { KeyboardScrollScopeProvider, useKeyboardHostReserveScope } from "./keyboardScrollScope"
import { usePageIsActive } from "./pageActive"
import { useMergedRef } from "./useMergedRef"
import { useRestingWindowHeight } from "./useRestingWindowHeight"
import { KEYBOARD_HIDE_EVENT, KEYBOARD_PLATFORM, KEYBOARD_SHOW_EVENT } from "./keyboardPlatform"


interface ScrollableAdapter {
  scrollToOffset: (node: any, offset: number) => void
  scrollEventThrottle?: number
}

const SCROLL_VIEW: ScrollableAdapter = {
  scrollToOffset: (node, offset) => {
    if (typeof node?.scrollTo === "function") node.scrollTo({ y: offset, animated: true })
  },
  scrollEventThrottle: 16,
}

const FLAT_LIST: ScrollableAdapter = {
  scrollToOffset: (node, offset) => {
    if (typeof node?.scrollToOffset === "function") node.scrollToOffset({ offset, animated: true })
  },
}

function measureViewportTop(node: any, apply: (top: number) => void): void {
  const measurable =
    typeof node?.measureInWindow === "function" ? node : node?.getNativeScrollRef?.()
  if (!measurable || typeof measurable.measureInWindow !== "function") {
    apply(0)
    return
  }
  measurable.measureInWindow((_x: number, y: number) => apply(typeof y === "number" ? y : 0))
}

function makeKeyboardAwareScrollable(
  Base: React.ComponentType<any>,
  options: KeyboardAwareScrollHostOptions,
  adapter: ScrollableAdapter,
): React.ComponentType<any> {
  const ownsFocusedInput = resolveHostFlag(options.ownsFocusedInput)
  const reserveKeyboardPadding = resolveHostFlag(options.reserveKeyboardPadding)
  const KeyboardAwareScrollable = forwardRef<any, any>(function KeyboardAwareScrollable(
    { contentContainerStyle, onScroll, scrollEventThrottle, horizontal, ...rest },
    ref,
  ) {
    const scopeId = useId()
    const innerRef = useRef<any>(null)
    const offsetRef = useRef(0)
    const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [state, setState] = useState(() => initialScrollKeyboardState(scopeId))
    const restingWindowHeight = useRestingWindowHeight()
    const insets = useContext(SafeAreaInsetsContext)
    const bottomInsetRef = useRef(insets?.bottom ?? 0)
    bottomInsetRef.current = insets?.bottom ?? 0

    const pageActive = usePageIsActive()
    const pageActiveRef = useRef(pageActive)
    pageActiveRef.current = pageActive

    const hostReserveScope = useKeyboardHostReserveScope()
    const hostReserveScopeRef = useRef(hostReserveScope)
    hostReserveScopeRef.current = hostReserveScope

    const dispatch = useCallback((signal: ScrollKeyboardSignal) => {
      setState((previous) => reduceScrollKeyboard(previous, signal))
    }, [])

    const setRefs = useMergedRef(innerRef, ref)

    const handleScroll = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        offsetRef.current = e.nativeEvent.contentOffset.y
        onScroll?.(e)
      },
      [onScroll],
    )

    const overlapOfEvent = useCallback(
      (endCoordinates: KeyboardEvent["endCoordinates"] | undefined) =>
        keyboardViewportOverlap({
          endCoordinates,
          windowHeight: Dimensions.get("window").height,
          restingWindowHeight: restingWindowHeight.current,
          platform: KEYBOARD_PLATFORM,
          systemBarInset: bottomInsetRef.current,
        }),
      [restingWindowHeight],
    )

    const liveOverlap = useCallback(
      () => (Keyboard.isVisible() ? overlapOfEvent(Keyboard.metrics()) : 0),
      [overlapOfEvent],
    )

    const seenFocusRef = useRef<{ node: unknown; scope: string | null }>({ node: null, scope: null })

    useEffect(() => {
      if (horizontal) return
      const apply = () => {
        const focus = keyboardFocusStore.getState()
        const seen = seenFocusRef.current
        seenFocusRef.current = { node: focus.node, scope: focus.scope }
        if (seen.node === focus.node && seen.scope === focus.scope) {
          dispatch({ type: "content-grew" })
          return
        }
        dispatch({
          type: "focus",
          scope: focus.scope,
          focused: focus.node !== null,
          overlap: liveOverlap(),
          reserves: pageActiveRef.current && reserveKeyboardPadding(),
          hostReserved: hostReserveScopeRef.current?.getState() ?? false,
        })
      }
      apply()
      return keyboardFocusStore.subscribe(apply)
    }, [dispatch, horizontal, liveOverlap])

    useEffect(() => {
      if (horizontal) return
      const clearHold = () => {
        if (holdRef.current === null) return
        clearTimeout(holdRef.current)
        holdRef.current = null
      }
      const showSub = Keyboard.addListener(KEYBOARD_SHOW_EVENT, (e) => {
        clearHold()
        dispatch({
          type: "show",
          overlap: overlapOfEvent(e.endCoordinates),
          reserves: pageActiveRef.current && reserveKeyboardPadding(),
          hostReserved: hostReserveScopeRef.current?.getState() ?? false,
        })
        if (pageActiveRef.current && keyboardFocusStore.getState().scope === scopeId) {
          options.onKeyboardShow?.()
        }
      })
      const hideSub = Keyboard.addListener(KEYBOARD_HIDE_EVENT, () => {
        dispatch({ type: "hide" })
        clearHold()
        holdRef.current = setTimeout(() => {
          holdRef.current = null
          dispatch({ type: "hold-expired" })
        }, motion.keyboardHandoffMs)
      })
      return () => {
        showSub.remove()
        hideSub.remove()
        clearHold()
      }
    }, [dispatch, horizontal, overlapOfEvent, scopeId])

    const reveals = scrollKeyboardReveals(state)
    // Re-measure only when the focused field, keyboard height, padding or reveal request moves, never
    // on every reducer step: each run may scroll the list.
    useEffect(() => {
      if (!reveals) return
      if (!pageActiveRef.current || !ownsFocusedInput()) return
      const node = innerRef.current
      const focus = keyboardFocusStore.getState()
      const target = focus.revealNode ?? focus.node
      if (!node || !target) return
      const keyboardTop = keyboardTopInWindow(Dimensions.get("window").height, state.overlap)
      if (keyboardTop <= 0) return
      measureViewportTop(node, (visibleTop) => {
        target.measureInWindow((_x: number, y: number, _w: number, h: number) => {
          if (typeof y !== "number" || typeof h !== "number") return
          const delta = revealScrollDelta({
            fieldTop: y,
            fieldHeight: h,
            keyboardTop,
            visibleTop,
            margin: KEYBOARD_REVEAL_MARGIN,
          })
          if (delta > 0) adapter.scrollToOffset(node, revealScrollTarget(offsetRef.current, delta))
        })
      })
    }, [reveals, state.focusedScope, state.overlap, state.reserve, state.revealVersion])

    const mergedContentStyle = useMemo(() => {
      if (horizontal) return contentContainerStyle
      return withExtraBottomPadding(contentContainerStyle, state.reserve)
    }, [contentContainerStyle, horizontal, state.reserve])

    const scrollable = (
      <Base
        ref={setRefs}
        horizontal={horizontal}
        contentContainerStyle={mergedContentStyle}
        onScroll={handleScroll}
        scrollEventThrottle={scrollEventThrottle ?? adapter.scrollEventThrottle}
        {...rest}
      />
    )

    if (horizontal) return scrollable
    return (
      <KeyboardScrollScopeProvider value={scopeId}>{scrollable}</KeyboardScrollScopeProvider>
    )
  })
  KeyboardAwareScrollable.displayName = "KeyboardAwareScrollable"
  return KeyboardAwareScrollable as unknown as React.ComponentType<any>
}

export function makeKeyboardAwareScrollHost(
  base: ScrollHostValue,
  options: KeyboardAwareScrollHostOptions = {},
): ScrollHostValue {
  return {
    ScrollView: makeKeyboardAwareScrollable(base.ScrollView, options, SCROLL_VIEW),
    FlatList: makeKeyboardAwareScrollable(base.FlatList, options, FLAT_LIST),
  }
}
