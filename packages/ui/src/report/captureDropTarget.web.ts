import { useCallback, useEffect, useRef, useState } from "react"
import type { ViewStyle } from "react-native"
import { shadowSchemes } from "@civfix/shared/tokens"
import type { Theme } from "../theme"
import { EASE_STANDARD_CSS } from "../theme/motion"
import { isDroppableType, type CaptureDropTarget, type DroppedItem } from "./captureDropTarget.shared"

function carriesDroppableFile(dt: DataTransfer | null): boolean {
  if (!dt) return false
  const items = Array.from(dt.items ?? [])
  const files = items.filter((i) => i.kind === "file")
  if (files.length === 0) return Array.from(dt.types ?? []).includes("Files")
  return files.some((i) => isDroppableType(i.type))
}

export function useCaptureDropTarget(
  enabled: boolean,
  onDrop: (items: readonly DroppedItem[]) => void,
): CaptureDropTarget {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const onDropRef = useRef(onDrop)
  useEffect(() => {
    onDropRef.current = onDrop
  }, [onDrop])

  const ref = useCallback((next: unknown) => {
    setNode((next ?? null) as HTMLElement | null)
  }, [])

  useEffect(() => {
    if (!enabled || !node) return
    let depth = 0
    const clear = () => {
      depth = 0
      setDragging(false)
    }
    const onEnter = (e: DragEvent) => {
      if (!carriesDroppableFile(e.dataTransfer)) return
      depth += 1
      setDragging(true)
    }
    const onOver = (e: DragEvent) => {
      if (!carriesDroppableFile(e.dataTransfer)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"
    }
    const onLeave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDropEvent = (e: DragEvent) => {
      e.preventDefault()
      clear()
      const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => isDroppableType(f.type))
      if (files.length > 0) onDropRef.current(files)
    }
    node.addEventListener("dragenter", onEnter)
    node.addEventListener("dragover", onOver)
    node.addEventListener("dragleave", onLeave)
    node.addEventListener("drop", onDropEvent)
    return () => {
      node.removeEventListener("dragenter", onEnter)
      node.removeEventListener("dragover", onOver)
      node.removeEventListener("dragleave", onLeave)
      node.removeEventListener("drop", onDropEvent)
      clear()
    }
  }, [enabled, node])

  return { ref, dragging: enabled && dragging, active: enabled }
}

export const captureDropTargetStyle: ViewStyle = {
  transitionProperty: "box-shadow",
  transitionDuration: "120ms",
  transitionTimingFunction: EASE_STANDARD_CSS,
} as ViewStyle

export function captureDropActiveStyleFor(theme: Theme): ViewStyle {
  return {
    boxShadow: [
      `inset 0 0 0 2px ${theme.colors.onAccent}`,
      `0 0 0 3px ${theme.colors.brand.bloom}`,
      shadowSchemes[theme.scheme].pin,
    ].join(", "),
  } as ViewStyle
}

