"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

export const NUM_CLASS = "font-display [font-feature-settings:'tnum']"

export const CHART_LABEL_FONT_SIZE = 11

const TOOLTIP_LIFT = 8

export function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof ResizeObserver === "undefined") {
      setWidth(el.getBoundingClientRect().width)
      return
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => observer.disconnect()
  }, [])

  return { ref, width }
}

export function niceTicks(
  maxValue: number,
  count = 4,
  options: { integer?: boolean } = {},
): number[] {
  if (maxValue <= 0) return [0, 1]
  const rawStep = maxValue / count
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const residual = rawStep / magnitude
  const niceStep =
    residual > 5
      ? 10 * magnitude
      : residual > 2
        ? 5 * magnitude
        : residual > 1
          ? 2 * magnitude
          : magnitude
  const step = options.integer ? Math.max(1, niceStep) : niceStep
  const ticks: number[] = []
  for (let value = 0; value <= maxValue + step * 0.001; value += step) {
    ticks.push(Number(value.toFixed(6)))
  }
  const last = ticks[ticks.length - 1]
  if (last !== undefined && last < maxValue) ticks.push(Number((last + step).toFixed(6)))
  return ticks
}

export function sparseIndices(length: number, target = 6): number[] {
  if (length <= target) return Array.from({ length }, (_, i) => i)
  const step = Math.ceil(length / target)
  const indices: number[] = []
  for (let i = 0; i < length; i += step) indices.push(i)
  const lastIndex = length - 1
  if (indices[indices.length - 1] !== lastIndex) indices.push(lastIndex)
  return indices
}

export interface RunPoint {
  index: number
  value: number
}

// A null is a k-suppressed point: it ends the run so a line never bridges the gap or dips to zero.
export function valueRuns(values: readonly (number | null)[]): RunPoint[][] {
  const runs: RunPoint[][] = []
  let current: RunPoint[] = []
  values.forEach((value, index) => {
    if (value === null) {
      if (current.length > 0) runs.push(current)
      current = []
      return
    }
    current.push({ index, value })
  })
  if (current.length > 0) runs.push(current)
  return runs
}

export function linePath(points: readonly { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")
}

export interface TooltipRow {
  label: string
  value: string
  color?: string
}

export interface TooltipState {
  x: number
  y: number
  title: string
  rows: TooltipRow[]
}

export function ChartTooltip({ tip }: { tip: TooltipState | null }) {
  if (!tip) return null
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-sm border border-console-line bg-console-surface px-token-3 py-token-2 shadow-console-2"
      style={{ left: tip.x, top: tip.y - TOOLTIP_LIFT }}
    >
      <p className="whitespace-nowrap text-token-12 font-semibold text-console-ink">{tip.title}</p>
      {tip.rows.map((row) => (
        <p
          key={row.label}
          className="flex items-center gap-token-2 whitespace-nowrap text-token-12 text-console-ink-2"
        >
          {row.color ? (
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-pill"
              style={{ background: row.color }}
            />
          ) : null}
          <span className="text-console-ink-3">{row.label}</span>
          <span className={cn("ml-auto pl-token-2 font-semibold text-console-ink", NUM_CLASS)}>
            {row.value}
          </span>
        </p>
      ))}
    </div>
  )
}

export interface LegendItem {
  label: string
  color: string
}

export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  if (items.length < 2) return null
  return (
    <div className={cn("flex flex-wrap items-center gap-x-token-4 gap-y-token-1", className)}>
      {items.map((item) => (
        <span
          key={item.label}
          className="flex items-center gap-token-1 text-token-12 text-console-ink-2"
        >
          <span aria-hidden className="h-2 w-2 rounded-pill" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  )
}
