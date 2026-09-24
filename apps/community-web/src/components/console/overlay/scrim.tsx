"use client"

import { cn } from "@/lib/utils"

const SCRIM_CLASS = "absolute inset-0 bg-console-scrim animate-in fade-in duration-d2"

// A dismissable scrim is a button so a tap outside closes the layer; it stays out of the tab order
// and the accessibility tree because Escape already gives keyboard and screen-reader users that exit.
export function Scrim({ onDismiss, className }: { onDismiss?: () => void; className?: string }) {
  if (!onDismiss) return <div aria-hidden className={SCRIM_CLASS} />
  return (
    <button
      type="button"
      aria-hidden
      tabIndex={-1}
      onClick={onDismiss}
      className={cn(className, SCRIM_CLASS)}
    />
  )
}
