import { useCallback, useState } from "react"
import { usePopoverAnchor } from "../../../primitives"
import type { AnchorRect } from "../../../primitives"

export interface ScopeMenuState {
  open: boolean
  rect: AnchorRect | null
  anchorRef: ReturnType<typeof usePopoverAnchor>["ref"]
  show: () => void
  close: () => void
}

export function useScopeMenu(): ScopeMenuState {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<AnchorRect | null>(null)
  const { ref: anchorRef, measure } = usePopoverAnchor(setRect)
  const show = useCallback(() => {
    measure()
    setOpen(true)
  }, [measure])
  const close = useCallback(() => setOpen(false), [])
  return { open, rect, anchorRef, show, close }
}
