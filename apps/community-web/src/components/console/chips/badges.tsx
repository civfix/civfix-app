"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function CountBadge({
  count,
  hot,
  className,
}: {
  count: number
  hot?: boolean
  className?: string
}) {
  if (count <= 0) return null
  return (
    <span
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-pill px-1.5 text-token-12 font-bold [font-feature-settings:'tnum']",
        hot
          ? "bg-console-bloom-soft text-console-bloom-strong"
          : "bg-console-surface-alt text-console-ink-2",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}

export function KbdHint({ keys, className }: { keys: string; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] items-center rounded-xs border border-console-line bg-console-surface px-1 font-mono text-token-12 font-medium text-console-ink-3 shadow-console-1",
        className,
      )}
    >
      {keys}
    </kbd>
  )
}

export function MetaDot({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("mx-1 inline-block text-console-ink-3", className)}>
      &middot;
    </span>
  )
}

export function MetaLine({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn("inline-flex min-w-0 items-center text-token-12 text-console-ink-3", className)}
    >
      {children}
    </span>
  )
}

export function SuppressedValue({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn("text-token-13 text-console-ink-3", className)}
      title={label}
      aria-label={label}
    >
      &mdash;
    </span>
  )
}
