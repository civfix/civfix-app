/**
 * useAutoGrowInput - drive a multiline TextInput's height from its content so the field starts ONE line
 * tall (= `min`, matching the round send/attach buttons in the same row) and grows with wrapped lines up
 * to `max`, then scrolls internally. Shared by the chat (ConversationBody) + report-comment
 * (DiscussionComposer) composers so both grow identically.
 *
 * Why a hook and not just `minHeight`: on react-native-web a `multiline` TextInput renders a <textarea>
 * whose intrinsic height comes from the `rows` attribute (browser-default 2), so it paints ~2 lines tall
 * regardless of `minHeight` - the "box is too tall on first render" bug. And rn-web's own
 * `onContentSizeChange` measures `scrollHeight`, which is FLOORED at the element's clientHeight, so once
 * the box has grown it can never shrink back as the user deletes lines. This hook sidesteps both:
 *   - WEB: it OWNS the measurement. On every `value` change (a layout effect, pre-paint) it momentarily
 *     collapses the <textarea> to `height:auto`, reads the true content `scrollHeight`, clamps to
 *     [min,max], and stores it as the controlled height. Collapsing first is what removes the scrollHeight
 *     floor, so the field can shrink as well as grow. rn-web forwards our `ref` to the real DOM node, so
 *     `scrollHeight` + a writable `style.height` are available there.
 *   - NATIVE: rn's `onContentSizeChange` already reports the true content height (it shrinks correctly),
 *     so the returned handler just clamps + stores it; the web layout effect is gated off.
 *
 * The host spreads `ref` onto the TextInput, applies `{ height }` in the input style, and wires
 * `onContentSizeChange`. `min`/`max` are the same px bounds the input style uses (min = the control
 * diameter; max = the scroll cap).
 */
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react"
import { Platform, type TextInput } from "react-native"

export interface AutoGrowInput {
  /** Attach to the TextInput. On web rn-web forwards this to the underlying <textarea> DOM node. */
  ref: RefObject<TextInput | null>
  /** The current clamped content height (px) to apply via the input's style `height`. */
  height: number
  /** Wire to the TextInput's `onContentSizeChange` (drives the NATIVE measurement; ignored on web). */
  onContentSizeChange: (e: { nativeEvent: { contentSize: { height: number } } }) => void
}

export function useAutoGrowInput(value: string, min: number, max: number): AutoGrowInput {
  const ref = useRef<TextInput | null>(null)
  const [height, setHeight] = useState(min)

  const clamp = useCallback((h: number) => Math.min(Math.max(Math.round(h), min), max), [min, max])

  // WEB: measure the underlying <textarea> by collapsing it to its content height, then clamp + store.
  // Two things are needed for an honest measurement:
  //   1. `rows = 1` - rn-web leaves a multiline <textarea>'s `rows` unset, so the browser defaults it to 2,
  //      which gives the element a 2-LINE intrinsic floor; `scrollHeight` would then report ~2 lines even
  //      for an empty field (the "box too tall" bug). Forcing rows=1 drops the floor to one line. We never
  //      restore it: the explicit `height` (from state, below) always overrides the rows-based visual
  //      height, so a stray rn-web re-render that resets rows can't change what the user sees.
  //   2. `height = "auto"` while reading - removes rn-web's scrollHeight floor so the field can SHRINK as
  //      lines are deleted, not just grow.
  // React re-applies the authoritative `height` on the render this triggers, so the raw style writes are
  // transient within this pre-paint effect and never flash.
  useLayoutEffect(() => {
    if (Platform.OS !== "web") return
    const node = ref.current as unknown as {
      scrollHeight: number
      rows: number
      style: { height: string }
    } | null
    if (!node || typeof node.scrollHeight !== "number") return
    node.rows = 1
    const prevHeight = node.style.height
    node.style.height = "auto"
    const next = clamp(node.scrollHeight)
    node.style.height = prevHeight
    setHeight((h) => (h === next ? h : next))
  }, [value, clamp])

  // NATIVE: rn already reports the true content height (which shrinks correctly); just clamp + store.
  const onContentSizeChange = useCallback(
    (e: { nativeEvent: { contentSize: { height: number } } }) => {
      if (Platform.OS === "web") return
      const next = clamp(e.nativeEvent.contentSize.height)
      setHeight((h) => (h === next ? h : next))
    },
    [clamp],
  )

  return { ref, height, onContentSizeChange }
}
