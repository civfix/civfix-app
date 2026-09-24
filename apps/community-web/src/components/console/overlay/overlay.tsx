"use client"

import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

import { useIsNarrow } from "../use-media-query"
import { Scrim } from "./scrim"
import { useEscape, useFocusTrap } from "./use-focus-trap"

export interface OverlayProps {
  open: boolean
  onClose: () => void
  trigger: ReactNode
  children: ReactNode
  align?: "start" | "end"
  side?: "bottom" | "top"
  width?: number
  label: string
  /** Panel id, so the trigger can point `aria-controls` at it. */
  id?: string
  className?: string
}

export function Overlay({
  open,
  onClose,
  trigger,
  children,
  align = "start",
  side = "bottom",
  width = 280,
  label,
  id,
  className,
}: OverlayProps) {
  const narrow = useIsNarrow()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEscape(open, onClose)
  useFocusTrap(panelRef, open, narrow)

  useEffect(() => {
    if (!open || narrow) return
    const handle = (event: MouseEvent) => {
      const wrapper = wrapperRef.current
      if (wrapper && !wrapper.contains(event.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open, narrow, onClose])

  if (narrow) {
    return (
      <div ref={wrapperRef} className="relative inline-block">
        {trigger}
        {open && typeof document !== "undefined"
          ? createPortal(
              <div className="fixed inset-0 z-console-sheet">
                <Scrim onDismiss={onClose} />
                <div
                  ref={panelRef}
                  id={id}
                  role="dialog"
                  aria-modal="true"
                  aria-label={label}
                  className={cn(
                    "absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-lg bg-console-surface p-token-4 pb-token-6 shadow-console-4",
                    "animate-in slide-in-from-bottom duration-d3 ease-out",
                    className,
                  )}
                >
                  <span
                    aria-hidden
                    className="mx-auto mb-token-3 block h-1 w-10 rounded-pill bg-console-line-strong"
                  />
                  {children}
                </div>
              </div>,
              document.body,
            )
          : null}
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative inline-block">
      {trigger}
      {open ? (
        <div
          ref={panelRef}
          id={id}
          role="dialog"
          aria-label={label}
          style={{ width }}
          className={cn(
            "absolute z-console-popover max-h-[min(420px,60vh)] overflow-y-auto rounded-sm border border-console-line bg-console-surface p-token-3 shadow-console-3",
            side === "bottom"
              ? "top-[calc(100%+theme(spacing.token-1))]"
              : "bottom-[calc(100%+theme(spacing.token-1))]",
            align === "start" ? "left-0" : "right-0",
            "animate-in fade-in zoom-in-95 duration-d1 ease-out",
            className,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}
