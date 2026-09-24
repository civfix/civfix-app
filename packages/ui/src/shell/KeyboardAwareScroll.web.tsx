/**
 * KeyboardAwareScroll (web seam): scrolls a focused field above the soft keyboard on mobile web. The
 * browser shrinks the visual viewport but not the layout viewport, so fields in the lower part of an
 * absolutely-positioned sheet sit under the keyboard, and RN `Keyboard` events never fire on
 * react-native-web.
 *
 *  1. Bottom content padding equal to the overlap, so the lower fields have somewhere to scroll to.
 *  2. On `focusin`, measure the field against the visual viewport and nudge scrollTop: the browser's own
 *     focus-scroll is unreliable inside an absolutely-positioned overflow:auto sheet.
 *
 * `reserveKeyboardPadding: false` is the load-bearing gate here, because `inset` is the raw overlap
 * regardless of who focused what; the `focusin` listener is already scoped to this scroll node. The
 * pinned-footer suppression reads the nearest KeyboardHostReserveScope, so a footer lifting one surface
 * never collapses the reserve of a scroller on a surface pushed over it.
 */
import React, { forwardRef, useCallback, useEffect, useMemo, useRef } from "react"
import { StyleSheet } from "react-native"
import type { ScrollHostValue } from "./ScrollHost"
import { useKeyboardHostReserved } from "./keyboardScrollScope"
import { KEYBOARD_REVEAL_MARGIN } from "./keyboardInsetModel"
import { isCoarsePointer } from "./webMedia"
import { useKeyboardInset } from "./useKeyboardInset.web"
import { resolveHostFlag, type KeyboardAwareScrollHostOptions } from "./KeyboardAwareScroll.types"
/** Lets the keyboard open and visualViewport settle before measuring. */
const SETTLE_MS = 140

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
  // Bound once per host (the options are module-level constants at every call site), so the effect
  // below does not depend on them.
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

    useEffect(() => {
      if (typeof window === "undefined") return
      if (!ownsFocusedInput()) return
      const el = getScrollableNode(innerRef.current)
      if (!el) return
      // Only a touch device raises a soft keyboard; on desktop focusing a field must not grow or scroll.
      const isTouch = isCoarsePointer()
      // Typed explicitly to avoid the node/DOM `Timeout` ambiguity.
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

    // Additive to the form's own bottom gutter; suppressed when a pinned footer in scope already reserved it.
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

/** `FlatList` passes through unchanged: list inputs live in the list header, never under the keyboard. */
export function makeKeyboardAwareScrollHost(
  base: ScrollHostValue,
  options: KeyboardAwareScrollHostOptions = {},
): ScrollHostValue {
  return {
    ScrollView: makeKeyboardAwareScrollView(base.ScrollView, options),
    FlatList: base.FlatList,
  }
}
