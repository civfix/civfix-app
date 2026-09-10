/**
 * KeyboardAwareScroll (native seam) - wrap a ScrollHost's ScrollView so a FOCUSED text field is always
 * scrolled ABOVE the on-screen keyboard while the user types.
 *
 * THE PROBLEM this fixes: a shell-scrolled body (CleanupForm, ProfileView edit, the discussion comment
 * composer, every "scroll" body) renders its fields inside the shell-injected ScrollView. When a field that
 * sits mid/low in a tall form is focused, the soft keyboard rises and COVERS it - the user can't see what
 * they're typing. The native CompactShell already sets the gorhom sheet's `keyboardBehavior="extend"` so the
 * SHEET grows to full height when the keyboard opens, but (a) gorhom only reacts to inputs it tracks via its
 * own BottomSheetTextInput - the bodies use plain RN TextInput - and (b) even when it does grow, that only
 * makes the sheet taller; it does NOT scroll the focused field up within the body's own scroll view, so a
 * lower field stays hidden behind the keyboard.
 *
 * THE FIX (library-free, mirrors the bespoke useKeyboardInset / useKeyboardVisible seams rather than pulling
 * in a native keyboard module - see ScrollHost's "single-RN / no new native lib" note): the wrapper listens
 * to RN `Keyboard` events, and on show it (1) optionally asks the host to grow to its tallest snap so there
 * is the most room above the keyboard (the native sheet passes `onKeyboardShow: () => setSnap(2)`), (2)
 * reserves bottom content padding equal to the keyboard height so the last fields have room to scroll up
 * past it, and (3) measures the currently-focused TextInput in the window and, if it overlaps the keyboard,
 * scrolls the container up by exactly that overlap (+ a small margin). The scroll offset is tracked off
 * `onScroll` so the absolute scrollTo target is correct. Crucially it uses `TextInput.State
 * .currentlyFocusedInput()` to find the field, so NO body/primitive needs a forwardRef or any change - the
 * fix lands entirely AT THE INJECTION SEAM: `useScrollHost().ScrollView` simply becomes keyboard-aware.
 *
 * Works for BOTH native scroll hosts: the gorhom `BottomSheetScrollView` (CompactShell.native, where the
 * sheet also extends) and the plain RN `ScrollView` (ExpandedShell, native tablet landscape). The base
 * component is passed in by `makeKeyboardAwareScrollHost` so this file never imports gorhom (import-guard).
 *
 * EXPLICIT OWNERSHIP (`ownsFocusedInput`, `reserveKeyboardPadding` — see KeyboardAwareScroll.types.ts).
 * Both heuristics above are GLOBAL, not scoped: `revealFocused` reads
 * `TextInput.State.currentlyFocusedInput()` with no descendant test, and the bottom reserve is added
 * whenever ANY keyboard opens. That is right for a form whose fields live in this scroller and wrong for a
 * host whose keyboard-raising input sits outside it — the docked search bar's TextInput lives in the
 * TabBar, so focusing it used to make the BASE feed scroll itself up and pad itself out, invisibly during
 * search and visibly left behind on exit. RN offers no cheap reliable ancestry check from a ScrollView ref,
 * so the host DECLARES the answer instead of guessing at it.
 *
 * THE PER-INSTANCE HALF (`usePageIsActive`). A declaration is per HOST, and `shell/PageStack.native`
 * injects ONE host into every resident page layer - so both heuristics also have to be scoped per
 * INSTANCE, or a buried page scrolls and pads itself for a keyboard the TOP page raised and is revealed
 * at the wrong offset on the pop. That gate lives inside the component below; it defaults to true wherever
 * no `PageActiveProvider` is mounted, i.e. everywhere except a page layer.
 *
 * The web sibling (KeyboardAwareScroll.web) does the same job off `window.visualViewport` (RN `Keyboard`
 * events never fire on rn-web); the `.ts` default re-exports the web one for tooling.
 */
import React, { forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import {
  Dimensions,
  Keyboard,
  Platform,
  StyleSheet,
  TextInput,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import type { ScrollHostValue } from "./ScrollHost"
import { resolveHostFlag, type KeyboardAwareScrollHostOptions } from "./KeyboardAwareScroll.types"
import { keyboardViewportOverlap } from "./keyboardInsetModel"
import { usePageIsActive } from "./pageActive"
import { useRestingWindowHeight } from "./useRestingWindowHeight"

/** Gap (px) kept between the bottom of the focused field and the top of the keyboard once revealed. */
const KEYBOARD_MARGIN = 16

const PLATFORM: "ios" | "android" | "other" =
  Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "other"

/**
 * Wrap a base ScrollView component (gorhom's BottomSheetScrollView or RN's ScrollView) into one that keeps
 * the focused TextInput visible above the keyboard. Created ONCE per host (stable component identity), so a
 * re-render never remounts the scroller (which would drop its scroll position).
 */
function makeKeyboardAwareScrollView(
  Base: React.ComponentType<any>,
  options: KeyboardAwareScrollHostOptions,
): React.ComponentType<any> {
  // Bound ONCE per host (the options are a module-level constant at every call site), so they are
  // invariants of the component rather than props — which is why the effect below does not depend on them.
  // A flag may be a THUNK (see KeyboardAwareScrollHostFlag): resolved per keyboard transition, so ONE host
  // can change behaviour without changing component identity — which would remount the whole scroller.
  const ownsFocusedInput = resolveHostFlag(options.ownsFocusedInput)
  const reserveKeyboardPadding = resolveHostFlag(options.reserveKeyboardPadding)
  const KeyboardAwareScrollView = forwardRef<any, any>(function KeyboardAwareScrollView(
    { contentContainerStyle, onScroll, scrollEventThrottle, ...rest },
    ref,
  ) {
    // The underlying scroll node (for scrollTo + measureInWindow) and the latest scroll offset (so an
    // absolute scrollTo target can be computed by delta from the focused field's window position).
    const innerRef = useRef<any>(null)
    const offsetRef = useRef(0)
    const [bottomReserve, setBottomReserve] = useState(0)
    const restingWindowHeight = useRestingWindowHeight()
    const insets = useContext(SafeAreaInsetsContext)
    const bottomInsetRef = useRef(insets?.bottom ?? 0)
    bottomInsetRef.current = insets?.bottom ?? 0

    // ----- PER-INSTANCE ACTIVITY GATE (the second half of "both heuristics are GLOBAL"). -----
    //
    // `ownsFocusedInput` / `reserveKeyboardPadding` are declared per HOST, and one host is injected into
    // every resident layer of `shell/PageStack.native` - so at stack depth N there are N live instances of
    // this component, all of them answering "yes, that focused field is mine" about a field on the TOP
    // page. A buried layer is a laid-out, absolutely-filled, scrollable screen (`pointerEvents: "none"`
    // does not stop an imperative `scrollTo`), so it really does scroll itself by the top page's keyboard
    // overlap - and on iOS pads its own content by the keyboard height, which guarantees it has the range
    // to move. Nothing ever puts it back, so popping to the parent reveals it at a different offset: the
    // retained scroll position the page stack exists to preserve, destroyed by a keyboard it never raised.
    //
    // A per-INSTANCE signal is the fix PortraitShell's keep-alive note already prescribed ("not a second
    // host") - swapping hosts per layer changes the ScrollView's element TYPE and remounts the very
    // subtree the stack retains. `usePageIsActive` DEFAULTS TRUE with no provider, and only
    // PageStack.native mounts one, so every other host (the sheet, the expanded panel, the base surface,
    // the gallery, web) is byte-identical.
    //
    // A REF, not the closure value: the listeners are registered in an effect keyed on `[revealFocused]`,
    // so a captured boolean would freeze at whatever it was when the layer first mounted - which for a
    // page pushed later is `true`, exactly the wrong answer.
    const pageActive = usePageIsActive()
    const pageActiveRef = useRef(pageActive)
    pageActiveRef.current = pageActive

    // Forward our internal ref AND any caller ref to the same node.
    const setRefs = useCallback(
      (node: any) => {
        innerRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) (ref as React.MutableRefObject<any>).current = node
      },
      [ref],
    )

    // Track the live scroll offset so a later scrollTo can target an absolute Y (offset + overlap). Still
    // forward the caller's onScroll (most bodies pass none; gorhom composes an external onScroll fine).
    const handleScroll = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        offsetRef.current = e.nativeEvent.contentOffset.y
        onScroll?.(e)
      },
      [onScroll],
    )

    const revealFocused = useCallback((keyboardTop: number) => {
      const scroll = innerRef.current
      const focused: any = TextInput.State.currentlyFocusedInput?.()
      if (!scroll || !focused || typeof focused.measureInWindow !== "function") return
      focused.measureInWindow((_x: number, y: number, _w: number, h: number) => {
        if (typeof y !== "number" || typeof h !== "number") return
        const overlap = y + h + KEYBOARD_MARGIN - keyboardTop
        if (overlap > 0 && typeof scroll.scrollTo === "function") {
          scroll.scrollTo({ y: Math.max(0, offsetRef.current + overlap), animated: true })
        }
      })
    }, [])

    useEffect(() => {
      const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
      const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"
      const overlapOf = (e: KeyboardEvent) =>
        keyboardViewportOverlap({
          endCoordinates: e.endCoordinates,
          windowHeight: Dimensions.get("window").height,
          restingWindowHeight: restingWindowHeight.current,
          platform: PLATFORM,
          systemBarInset: bottomInsetRef.current,
        })
      const showSub = Keyboard.addListener(showEvt, (e) => {
        setBottomReserve(pageActiveRef.current && reserveKeyboardPadding() ? overlapOf(e) : 0)
        options.onKeyboardShow?.()
      })
      const hideSub = Keyboard.addListener(hideEvt, () => setBottomReserve(0))
      // Always SUBSCRIBED; the ownership question is asked per event, because the answer may be a thunk.
      const didShowSub = Keyboard.addListener("keyboardDidShow", (e) => {
        if (!pageActiveRef.current || !ownsFocusedInput()) return
        const top = Dimensions.get("window").height - overlapOf(e)
        if (top > 0) requestAnimationFrame(() => revealFocused(top))
      })
      return () => {
        showSub.remove()
        hideSub.remove()
        didShowSub.remove()
      }
    }, [revealFocused])

    const mergedContentStyle = useMemo(() => {
      const flat = (StyleSheet.flatten(contentContainerStyle) || {}) as { paddingBottom?: number }
      const basePad = typeof flat.paddingBottom === "number" ? flat.paddingBottom : 0
      return [contentContainerStyle, { paddingBottom: basePad + bottomReserve }]
    }, [contentContainerStyle, bottomReserve])

    return (
      <Base
        ref={setRefs}
        contentContainerStyle={mergedContentStyle}
        onScroll={handleScroll}
        scrollEventThrottle={scrollEventThrottle ?? 16}
        {...rest}
      />
    )
  })
  KeyboardAwareScrollView.displayName = "KeyboardAwareScrollView"
  return KeyboardAwareScrollView as unknown as React.ComponentType<any>
}

/**
 * Wrap a ScrollHost so its `ScrollView` keeps the focused field above the keyboard. The `FlatList` is passed
 * through unchanged: long lists put their text input in the LIST HEADER (the top), which the keyboard never
 * covers, and measuring a focused row inside a virtualized list is unreliable.
 */
export function makeKeyboardAwareScrollHost(
  base: ScrollHostValue,
  options: KeyboardAwareScrollHostOptions = {},
): ScrollHostValue {
  return {
    ScrollView: makeKeyboardAwareScrollView(base.ScrollView, options),
    FlatList: base.FlatList,
  }
}
