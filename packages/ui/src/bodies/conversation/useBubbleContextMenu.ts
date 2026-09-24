import { useCallback, useEffect, useState } from "react"
import { Dimensions } from "react-native"
import { usePopoverAnchor } from "../../primitives"
import type { AnchorRect } from "../../primitives"

export type BubbleMenuMode = "closed" | "menu" | "confirm" | "confirm-stop"

export function useBubbleContextMenu() {
  const [mode, setMode] = useState<BubbleMenuMode>("closed")
  const [everOpened, setEverOpened] = useState(false)
  const [rect, setRect] = useState<AnchorRect | null>(null)
  const onMeasured = useCallback((next: AnchorRect) => {
    setRect(next)
    setMode("menu")
  }, [])
  const { ref: anchorRef, measure } = usePopoverAnchor(onMeasured)
  useEffect(() => {
    if (mode === "closed") return
    const sub = Dimensions.addEventListener("change", () => setMode("closed"))
    return () => sub.remove()
  }, [mode])
  // Stable so the memoized BubbleAttachments, which takes `open` as its long-press handler, skips the
  // bubble's own menu and hover state updates.
  const open = useCallback(() => {
    setEverOpened(true)
    const node = anchorRef.current
    if (node && typeof node.measureInWindow === "function") {
      measure()
    } else {
      setRect(null)
      setMode("menu")
    }
  }, [anchorRef, measure])
  const close = useCallback(() => setMode((current) => (current === "menu" ? "closed" : current)), [])
  return { mode, setMode, everOpened, rect, anchorRef, open, close }
}

export type BubbleContextMenu = ReturnType<typeof useBubbleContextMenu>
