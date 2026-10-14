import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react"
import { Platform, type TextInput } from "react-native"

export interface AutoGrowInput {
  ref: RefObject<TextInput | null>
  height: number
  onContentSizeChange: (e: { nativeEvent: { contentSize: { height: number } } }) => void
}

export function useAutoGrowInput(value: string, min: number, max: number): AutoGrowInput {
  const ref = useRef<TextInput | null>(null)
  const [height, setHeight] = useState(min)

  const clamp = useCallback((h: number) => Math.min(Math.max(Math.round(h), min), max), [min, max])

  // rn-web renders a multiline TextInput as a <textarea> whose unset `rows` defaults to 2 (a two-line
  // floor that `minHeight` cannot beat), and its own onContentSizeChange reads a `scrollHeight` floored at
  // clientHeight, so the box could never shrink. Forcing rows=1 and collapsing to `height: auto` before
  // reading removes both floors; the controlled `height` overrides rows visually, and React re-applies it
  // on the next render, so these pre-paint style writes never flash.
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
