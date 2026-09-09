"use client"

import { Lock } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ToggleRowProps {
  label: string
  caption?: string
  checked: boolean
  onChange: (checked: boolean) => void
  locked?: boolean
  lockedReason?: string
  className?: string
}

export function ToggleRow({
  label,
  caption,
  checked,
  onChange,
  locked,
  lockedReason,
  className,
}: ToggleRowProps) {
  return (
    <div
      className={cn(
        "flex min-h-[44px] items-center gap-token-3 border-b border-console-line py-token-3 last:border-b-0",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-token-14 font-semibold text-console-ink">
          {label}
          {locked && lockedReason ? (
            <span title={lockedReason}>
              <Lock aria-hidden className="h-3.5 w-3.5 text-console-ink-3" />
              <span className="sr-only">{lockedReason}</span>
            </span>
          ) : null}
        </p>
        {caption ? <p className="mt-0.5 text-token-12 text-console-ink-3">{caption}</p> : null}
        {locked && lockedReason ? (
          <p className="mt-0.5 text-token-12 font-medium text-console-ink-3">{lockedReason}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={locked}
        onClick={() => onChange(!checked)}
        className={cn(
          "flex h-11 min-w-11 shrink-0 items-center justify-center rounded-sm focus-visible:outline-none focus-visible:shadow-console-ring",
          locked && "cursor-not-allowed opacity-50",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "relative h-5 w-9 rounded-pill transition-colors duration-d2 ease-out",
            checked ? "bg-console-moss-strong" : "bg-console-line-strong",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-pill bg-console-surface shadow-console-1 transition-all duration-d2 ease-out",
              checked ? "left-[18px]" : "left-0.5",
            )}
          />
        </span>
      </button>
    </div>
  )
}
