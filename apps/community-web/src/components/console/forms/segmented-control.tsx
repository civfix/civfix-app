"use client"

import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface SegmentedOption<V extends string> {
  value: V
  label: string
  icon?: LucideIcon
  disabled?: boolean
  disabledReason?: string
}

export interface SegmentedControlProps<V extends string> {
  options: readonly SegmentedOption<V>[]
  value: V
  onChange: (value: V) => void
  size?: "sm" | "md"
  label?: string
  className?: string
}

const SEGMENT_SIZE = {
  sm: "h-7 px-token-2 text-token-12",
  md: "h-9 px-token-3 text-token-13",
} as const

export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  size = "md",
  label,
  className,
}: SegmentedControlProps<V>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-sm bg-console-surface-alt p-token-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={option.disabled}
            title={option.disabled ? option.disabledReason : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xs font-semibold transition-colors duration-d1 ease-out focus-visible:outline-none focus-visible:shadow-console-ring",
              SEGMENT_SIZE[size],
              active
                ? "bg-console-surface text-console-ink shadow-console-1"
                : "text-console-ink-3 hover:text-console-ink-2",
              option.disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {Icon ? <Icon aria-hidden className="h-3.5 w-3.5" /> : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
