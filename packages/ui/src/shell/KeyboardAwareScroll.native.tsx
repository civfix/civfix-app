import React, {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import {
  Dimensions,
  Keyboard,
  Platform,
  StyleSheet,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import { theme } from "../theme"
import type { ScrollHostValue } from "./ScrollHost"
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
  type ScrollKeyboardSignal,
} from "./keyboardScrollModel"
import { KeyboardScrollScopeProvider } from "./keyboardScrollScope"
import { usePageIsActive } from "./pageActive"
import { useRestingWindowHeight } from "./useRestingWindowHeight"

const PLATFORM: "ios" | "android" | "other" =
  Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "other"

const SHOW_EVENT = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
const HIDE_EVENT = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"

type ScrollCommand = (node: any, offset: number) => void

const scrollViewCommand: ScrollCommand = (node, offset) => {
  if (typeof node?.scrollTo === "function") node.scrollTo({ y: offset, animated: true })
}

const flatListCommand: ScrollCommand = (node, offset) => {
  if (typeof node?.scrollToOffset === "function") node.scrollToOffset({ offset, animated: true })
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
  scrollToOffset: ScrollCommand,
): React.ComponentType<any> {
  const ownsFocusedInput = resolveHostFlag(options.ownsFocusedInput)
  const reserveKeyboardPadding = resolveHostFlag(options.reserveKeyboardPadding)
  const KeyboardAwareScrollable = forwardRef<any, any>(function KeyboardAwareScrollable(
    { contentContainerStyle, onScroll, scrollEventThrottle, ...rest },
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

    const dispatch = useCallback((signal: ScrollKeyboardSignal) => {
      setState((previous) => reduceScrollKeyboard(previous, signal))
    }, [])

    const setRefs = useCallback(
      (node: any) => {
        innerRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) (ref as React.MutableRefObject<any>).current = node
      },
      [ref],
    )

    const handleScroll = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        offsetRef.current = e.nativeEvent.contentOffset.y
        onScroll?.(e)
      },
      [onScroll],
    )

    const focus = useSyncExternalStore(keyboardFocusStore.subscribe, keyboardFocusStore.getState)
    const seenFocusRef = useRef<{ node: unknown; scope: string | null }>({ node: null, scope: null })

    useEffect(() => {
      const seen = seenFocusRef.current
      seenFocusRef.current = { node: focus.node, scope: focus.scope }
      if (seen.node === focus.node && seen.scope === focus.scope) {
        dispatch({ type: "content-grew" })
        return
      }
      dispatch({ type: "focus", scope: focus.scope, version: focus.version })
    }, [dispatch, focus])

    useEffect(() => {
      const overlapOf = (e: KeyboardEvent) =>
        keyboardViewportOverlap({
          endCoordinates: e.endCoordinates,
          windowHeight: Dimensions.get("window").height,
          restingWindowHeight: restingWindowHeight.current,
          platform: PLATFORM,
          systemBarInset: bottomInsetRef.current,
        })
      const clearHold = () => {
        if (holdRef.current === null) return
        clearTimeout(holdRef.current)
        holdRef.current = null
      }
      const showSub = Keyboard.addListener(SHOW_EVENT, (e) => {
        clearHold()
        dispatch({
          type: "show",
          overlap: overlapOf(e),
          reserves: pageActiveRef.current && reserveKeyboardPadding(),
        })
        if (pageActiveRef.current && keyboardFocusStore.getState().scope === scopeId) {
          options.onKeyboardShow?.()
        }
      })
      const hideSub = Keyboard.addListener(HIDE_EVENT, () => {
        dispatch({ type: "hide" })
        clearHold()
        holdRef.current = setTimeout(() => {
          holdRef.current = null
          dispatch({ type: "hold-expired" })
        }, theme.motion.keyboardHandoffMs)
      })
      return () => {
        showSub.remove()
        hideSub.remove()
        clearHold()
      }
    }, [dispatch, restingWindowHeight, scopeId])

    useEffect(() => {
      if (state.revealVersion === 0 || state.overlap <= 0) return
      if (!pageActiveRef.current || !ownsFocusedInput()) return
      const node = innerRef.current
      const focused = keyboardFocusStore.getState().node
      if (!node || !focused) return
      const keyboardTop = keyboardTopInWindow(Dimensions.get("window").height, state.overlap)
      if (keyboardTop <= 0) return
      measureViewportTop(node, (visibleTop) => {
        focused.measureInWindow((_x: number, y: number, _w: number, h: number) => {
          if (typeof y !== "number" || typeof h !== "number") return
          const delta = revealScrollDelta({
            fieldTop: y,
            fieldHeight: h,
            keyboardTop,
            visibleTop,
            margin: KEYBOARD_REVEAL_MARGIN,
          })
          if (delta > 0) scrollToOffset(node, revealScrollTarget(offsetRef.current, delta))
        })
      })
    }, [state.overlap, state.reserve, state.revealVersion])

    const mergedContentStyle = useMemo(() => {
      const flat = (StyleSheet.flatten(contentContainerStyle) || {}) as { paddingBottom?: number }
      const basePad = typeof flat.paddingBottom === "number" ? flat.paddingBottom : 0
      return [contentContainerStyle, { paddingBottom: basePad + state.reserve }]
    }, [contentContainerStyle, state.reserve])

    return (
      <KeyboardScrollScopeProvider value={scopeId}>
        <Base
          ref={setRefs}
          contentContainerStyle={mergedContentStyle}
          onScroll={handleScroll}
          scrollEventThrottle={scrollEventThrottle ?? 16}
          {...rest}
        />
      </KeyboardScrollScopeProvider>
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
    ScrollView: makeKeyboardAwareScrollable(base.ScrollView, options, scrollViewCommand),
    FlatList: makeKeyboardAwareScrollable(base.FlatList, options, flatListCommand),
  }
}
