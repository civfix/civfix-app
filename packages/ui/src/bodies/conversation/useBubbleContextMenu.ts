import { useEffect, useState } from "react"
import { Dimensions } from "react-native"
import { usePopoverAnchor } from "../../primitives"
import type { AnchorRect } from "../../primitives"

export type BubbleMenuMode = "closed" | "menu" | "confirm" | "confirm-stop"

export function useBubbleContextMenu() {
  const [mode, setMode] = useState<BubbleMenuMode>("closed")
  const [everOpened, setEverOpened] = useState(false)
  const [rect, setRect] = useState<AnchorRect | null>(null)
  const { ref: anchorRef, measure } = usePopoverAnchor((next) => {
    setRect(next)
    setMode("menu")
  })
  useEffect(() => {
    if (mode === "closed") return
    const sub = Dimensions.addEventListener("change", () => setMode("closed"))
    return () => sub.remove()
  }, [mode])
  const open = () => {
    setEverOpened(true)
    const node = anchorRef.current
    if (node && typeof node.measureInWindow === "function") {
      measure()
    } else {
      setRect(null)
      setMode("menu")
    }
  }
  const close = () => setMode((current) => (current === "menu" ? "closed" : current))
  return { mode, setMode, everOpened, rect, anchorRef, open, close }
}

export type BubbleContextMenu = ReturnType<typeof useBubbleContextMenu>
