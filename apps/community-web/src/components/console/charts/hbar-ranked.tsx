"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import { formatCompact, NUM_CLASS } from "./chart-utils"
import { useChartPalette } from "./palette"

export interface HBarItem {
  id: string
  label: string
  value: number
  sublabel?: string
  valueLabel?: string
  color?: string
  trailing?: ReactNode
}

export interface HBarRankedProps {
  items: readonly HBarItem[]
  summary: string
  max?: number
  className?: string
}

export function HBarRanked({
  items,
  summary,
  max,
  className,
}: HBarRankedProps) {
  const palette = useChartPalette()
  const scaleMax = max ?? Math.max(1, ...items.map((item) => item.value))

  return (
    <div className={cn("flex flex-col gap-token-1", className)} role="list" aria-label={summary}>
      {items.map((item) => {
        const pct = Math.min(100, (item.value / scaleMax) * 100)
        const color = item.color ?? palette.hue.sky
        return (
          <div
            key={item.id}
            role="listitem"
            className="flex min-h-11 w-full items-center gap-token-3 rounded-sm px-token-2"
          >
            <span className="flex min-w-0 flex-1 items-baseline gap-token-2">
              <span className="truncate text-token-13 text-console-ink" title={item.label}>
                {item.label}
              </span>
              {item.sublabel ? (
                <span className="shrink-0 text-token-12 text-console-ink-3">{item.sublabel}</span>
              ) : null}
            </span>
            <span className="h-2 w-2/5 shrink-0 overflow-hidden rounded-pill bg-console-surface-alt">
              <span
                aria-hidden
                className="block h-full rounded-pill transition-[width] duration-d3 ease-out"
                style={{ width: `${pct}%`, background: color }}
              />
            </span>
            <span
              className={cn(
                "min-w-12 shrink-0 whitespace-nowrap text-right text-token-13 text-console-ink-2",
                NUM_CLASS,
              )}
            >
              {item.valueLabel ?? formatCompact(item.value)}
            </span>
            {item.trailing}
          </div>
        )
      })}
    </div>
  )
}
