"use client"

import { Check } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ChipMultiSelectOption {
  value: string
  label: string
  icon?: LucideIcon
  disabled?: boolean
}

export interface ChipMultiSelectProps {
  options: readonly ChipMultiSelectOption[]
  values: readonly string[]
  onChange: (values: string[]) => void
  label?: string
  className?: string
}

export function ChipMultiSelect({
  options,
  values,
  onChange,
  label,
  className,
}: ChipMultiSelectProps) {
  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value])
  }
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-token-1", className)}>
      {options.map((option) => {
        const active = values.includes(option.value)
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={option.disabled}
            onClick={() => toggle(option.value)}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-pill border px-token-3 text-token-13 font-semibold transition-colors duration-d1 ease-out focus-visible:outline-none focus-visible:shadow-console-ring",
              active
                ? "border-console-ink bg-console-ink text-console-surface"
                : "border-console-line bg-console-surface text-console-ink-2 hover:bg-console-surface-alt",
              option.disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {active ? <Check aria-hidden className="h-3.5 w-3.5" /> : null}
            {Icon && !active ? <Icon aria-hidden className="h-3.5 w-3.5" /> : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
