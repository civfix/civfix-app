/**
 * KeyboardAwareScroll (web seam) - wrap a ScrollHost's ScrollView so a FOCUSED text field is scrolled ABOVE
 * the on-screen keyboard on mobile web (the rn-web sibling of KeyboardAwareScroll.native).
 *
 * THE PROBLEM: on mobile web the home sheet (CompactShell.web) is `position:absolute; bottom:0` with a FIXED
 * height, and the expanded sidebar is pinned `bottom:14`. When the soft keyboard opens the browser shrinks
 * the VISUAL viewport but NOT the layout viewport, so the scroll container's lower portion - and any field
 * in it - sits UNDER the keyboard. RN `Keyboard` events never fire on rn-web, so the only signal is
 * `window.visualViewport` (already wrapped by useKeyboardInset.web).
 *
 * THE FIX, applied transparently at the injection seam (no body changes):
 *   1. Reserve bottom content padding == the keyboard overlap (useKeyboardInset) so the scroll range extends
 *      past the keyboard - there is somewhere to scroll the lower fields TO.
 *   2. On `focusin` of an input/textarea inside the scroller, measure it against the shrunken visual viewport
 *      and, if it is covered, nudge the scroller (scrollTop) so the field sits just above the keyboard. The
 *      browser's own focus-scroll is unreliable inside an absolutely-positioned overflow:auto sheet, so we
 *      do it explicitly.
 *   3. Optionally ask the host to grow to its tallest snap (the web sheet passes `onKeyboardShow:
 *      () => setSnap(2)`), for maximum room, mirroring the native seam.
 *
 * rn-web's ScrollView exposes the underlying scrollable DOM node via `getScrollableNode()`, and its
 * TextInputs ARE real DOM <input>/<textarea>, so a measured DOM scroll is exact.
 *
 * EXPLICIT OWNERSHIP (`ownsFocusedInput`, `reserveKeyboardPadding` — see KeyboardAwareScroll.types.ts).
 * The two behaviours above are the web mirrors of the native seam's, and carry the same two gates for the
 * same reason: a host whose keyboard-raising input sits OUTSIDE its scroller must not scroll itself to
 * reveal somebody else's field, and a host whose ancestor already reserved the overlap must not add a
 * second inset. Note the web `focusin` reveal is at least SCOPED to this scroll node (the listener is on
 * the element), so `ownsFocusedInput: false` here is belt-and-braces; `reserveKeyboardPadding: false` is
 * the load-bearing one, because `inset` is the raw visual-viewport overlap regardless of who focused what.
 */
import React, { forwardRef, useCallback, useEffect, useMemo, useRef } from "react"
import { StyleSheet } from "react-native"
import type { ScrollHostValue } from "./ScrollHost"
import { useKeyboardHostReserved } from "./keyboardHostReserveStore"
import { KEYBOARD_REVEAL_MARGIN } from "./keyboardInsetModel"
import { useKeyboardInset } from "./useKeyboardInset.web"
import { resolveHostFlag, type KeyboardAwareScrollHostOptions } from "./KeyboardAwareScroll.types"
/** Delay (ms) before measuring on focus, so the keyboard has opened + visualViewport has settled. */
const SETTLE_MS = 140

/** Resolve the underlying scrollable DOM node of an rn-web ScrollView (exposes scrollTop/scrollIntoView). */
function getScrollableNode(node: any): HTMLElement | null {
  if (!node) return null
  if (typeof node.getScrollableNode === "function") {
    const el = node.getScrollableNode()
    return el && typeof el.scrollTop === "number" ? (el as HTMLElement) : null
  }
  return typeof node.scrollTop === "number" ? (node as HTMLElement) : null
}

function makeKeyboardAwareScrollView(
  Base: React.ComponentType<any>,
  options: KeyboardAwareScrollHostOptions,
): React.ComponentType<any> {
  // Bound ONCE per host (the options are a module-level constant at every call site), so they are
  // invariants of the component rather than props — which is why the effect below does not depend on them.
  // Either may be a THUNK (see KeyboardAwareScrollHostFlag), read at USE time so one host can change
  // behaviour without changing component identity (which would remount the scroller and drop its offset).
  const ownsFocusedInput = resolveHostFlag(options.ownsFocusedInput)
  const reserveKeyboardPadding = resolveHostFlag(options.reserveKeyboardPadding)
  const KeyboardAwareScrollView = forwardRef<any, any>(function KeyboardAwareScrollView(
    { contentContainerStyle, ...rest },
    ref,
  ) {
    const innerRef = useRef<any>(null)
    const inset = useKeyboardInset()
    const hostReserved = useKeyboardHostReserved()

    const setRefs = useCallback(
      (node: any) => {
        innerRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) (ref as React.MutableRefObject<any>).current = node
      },
      [ref],
    )

    // Reveal a focused field above the soft keyboard: when an input inside this scroller gains focus, grow
    // the host (if it asked) and, after the keyboard + visualViewport settle, measure the field against the
    // visual viewport and nudge scrollTop so it clears the keyboard.
    useEffect(() => {
      if (typeof window === "undefined") return
      // This host declares it owns no focused input (the docked search bar's field, the reply composer),
      // so there is nothing here to reveal.
      if (!ownsFocusedInput()) return
      const el = getScrollableNode(innerRef.current)
      if (!el) return
      // Only a TOUCH device raises a soft keyboard; on a desktop (fine pointer + hardware keyboard) focusing
      // a field must NOT grow the sheet or scroll. Gate the keyboard-driven behavior behind a coarse pointer.
      const isTouch = window.matchMedia?.("(pointer: coarse)")?.matches ?? false
      // DOM setTimeout returns a number; typed explicitly to avoid the node/DOM `Timeout` ambiguity.
      let settleTimer: number | undefined
      const onFocusIn = (e: FocusEvent) => {
        const target = e.target as HTMLElement | null
        if (!isTouch || !target || !/^(INPUT|TEXTAREA)$/.test(target.tagName)) return
        options.onKeyboardShow?.()
        if (settleTimer !== undefined) window.clearTimeout(settleTimer)
        settleTimer = window.setTimeout(() => {
          const vv = window.visualViewport
          const viewportBottom = vv ? vv.height + vv.offsetTop : window.innerHeight
          const rect = target.getBoundingClientRect()
          const over = rect.bottom - (viewportBottom - KEYBOARD_REVEAL_MARGIN)
          if (over > 0) el.scrollTop += over
        }, SETTLE_MS) as unknown as number
      }
      el.addEventListener("focusin", onFocusIn)
      return () => {
        el.removeEventListener("focusin", onFocusIn)
        if (settleTimer !== undefined) window.clearTimeout(settleTimer)
      }
    }, [])

    // Reserve bottom padding == keyboard overlap so the lower fields can scroll up past it (additive to the
    // form's own bottom gutter). Suppressed when an ancestor already reserved it.
    const mergedContentStyle = useMemo(() => {
      const flat = (StyleSheet.flatten(contentContainerStyle) || {}) as { paddingBottom?: number }
      const basePad = typeof flat.paddingBottom === "number" ? flat.paddingBottom : 0
      const reserve = reserveKeyboardPadding() && !hostReserved ? inset : 0
      return [contentContainerStyle, { paddingBottom: basePad + reserve }]
    }, [contentContainerStyle, hostReserved, inset])

    return <Base ref={setRefs} contentContainerStyle={mergedContentStyle} {...rest} />
  })
  KeyboardAwareScrollView.displayName = "KeyboardAwareScrollView"
  return KeyboardAwareScrollView as unknown as React.ComponentType<any>
}

/**
 * Wrap a ScrollHost so its `ScrollView` keeps the focused field above the keyboard on mobile web. `FlatList`
 * is passed through unchanged (list inputs live in the LIST HEADER, never under the keyboard).
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
