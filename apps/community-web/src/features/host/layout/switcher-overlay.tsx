"use client"

import type { Dispatch, ReactNode, SetStateAction } from "react"
import { ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Overlay } from "@/components/console/overlay/overlay"

const SWITCHER_WIDTH = 320

export interface SwitcherOverlayProps {
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  label: string
  leading?: ReactNode
  className?: string
  children: ReactNode
}

export function SwitcherOverlay({
  open,
  setOpen,
  label,
  leading,
  className,
  children,
}: SwitcherOverlayProps) {
  return (
    <Overlay
      open={open}
      onClose={() => setOpen(false)}
      align="end"
      width={SWITCHER_WIDTH}
      label={label}
      trigger={
        <button
          type="button"
          aria-expanded={open}
          // The overlay is a dialog holding a plain list of links, not a role=menu.
          aria-haspopup="dialog"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-sm border border-console-line bg-console-surface px-token-3 text-token-13 font-semibold text-console-ink-2 transition-colors duration-d1 hover:bg-console-surface-alt hover:text-console-ink focus-visible:outline-none focus-visible:shadow-console-ring",
            className,
          )}
        >
          {leading}
          {label}
          <ChevronsUpDown aria-hidden className="h-3.5 w-3.5" />
        </button>
      }
    >
      {children}
    </Overlay>
  )
}
