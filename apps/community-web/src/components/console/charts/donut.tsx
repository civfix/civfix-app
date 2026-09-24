"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { formatCompact, NUM_CLASS } from "./chart-utils"
import { useChartPalette } from "./palette"

export interface DonutSegment {
  id: string
  label: string
  value: number
  color?: string
}

export interface DonutProps {
  segments: readonly DonutSegment[]
  summary: string
  size?: number
  thickness?: number
  centerLabel?: string
  centerValue?: string
  valueFormat?: (value: number) => string
  onSegmentPress?: (id: string) => void
  className?: string
}

export function Donut({
  segments,
  summary,
  size = 168,
  thickness = 18,
  centerLabel,
  centerValue,
  valueFormat = formatCompact,
  onSegmentPress,
  className,
}: DonutProps) {
  const palette = useChartPalette()
  const [hovered, setHovered] = useState<string | null>(null)
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const gap = segments.length > 1 ? 2 : 0
  let offset = 0

  return (
    <div className={cn("flex flex-wrap items-center gap-token-5", className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={summary}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={palette.track}
          strokeWidth={thickness}
        />
        {total > 0
          ? segments.map((segment, i) => {
              const fraction = segment.value / total
              const length = Math.max(0, fraction * circumference - gap)
              const dashOffset = -offset
              offset += fraction * circumference
              const color = segment.color ?? palette.seriesColor(i)
              return (
                <circle
                  key={segment.id}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={color}
                  strokeWidth={hovered === segment.id ? thickness + 4 : thickness}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  className={cn(
                    "transition-all duration-d2 ease-out motion-reduce:transition-none",
                    onSegmentPress && "cursor-pointer",
                  )}
                  onMouseEnter={() => setHovered(segment.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onSegmentPress?.(segment.id)}
                />
              )
            })
          : null}
        {centerValue ? (
          <text
            x={size / 2}
            y={size / 2 - (centerLabel ? 2 : -4)}
            textAnchor="middle"
            fontSize={22}
            fontWeight={700}
            fill={palette.strong}
            className={NUM_CLASS}
          >
            {centerValue}
          </text>
        ) : null}
        {centerLabel ? (
          <text
            x={size / 2}
            y={size / 2 + 16}
            textAnchor="middle"
            fontSize={11}
            fill={palette.label}
          >
            {centerLabel}
          </text>
        ) : null}
      </svg>
      <ul className="flex min-w-32 flex-col gap-token-1">
        {segments.map((segment, i) => {
          const color = segment.color ?? palette.seriesColor(i)
          const pct = total > 0 ? Math.round((segment.value / total) * 100) : 0
          const row = (
            <>
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-pill"
                style={{ background: color }}
              />
              <span className="truncate text-token-13 text-console-ink-2">{segment.label}</span>
              <span className={cn("ml-auto text-token-13 text-console-ink", NUM_CLASS)}>
                {valueFormat(segment.value)}
              </span>
              <span className={cn("w-9 text-right text-token-12 text-console-ink-3", NUM_CLASS)}>
                {pct}%
              </span>
            </>
          )
          return (
            <li key={segment.id}>
              {onSegmentPress ? (
                <button
                  type="button"
                  onClick={() => onSegmentPress(segment.id)}
                  onMouseEnter={() => setHovered(segment.id)}
                  onMouseLeave={() => setHovered(null)}
                  className="flex w-full items-center gap-token-2 rounded-sm px-token-1 py-0.5 text-left hover:bg-console-surface-alt focus-visible:outline-none focus-visible:shadow-console-ring"
                >
                  {row}
                </button>
              ) : (
                <span className="flex w-full items-center gap-token-2 px-token-1 py-0.5">{row}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
