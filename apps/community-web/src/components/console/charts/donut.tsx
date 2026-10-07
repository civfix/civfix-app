"use client"

import { useState } from "react"
import { formatCount } from "@civfix/shared"
import { useLocale } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

import { CHART_LABEL_FONT_SIZE, NUM_CLASS } from "./chart-utils"
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
  className?: string
}

const SEGMENT_GAP = 2
const HOVER_GROWTH = 4
const CENTER_VALUE_FONT_SIZE = 22
const VALUE_OFFSET_WITH_LABEL = -2
const VALUE_OFFSET_ALONE = 4
const CENTER_LABEL_OFFSET = 16

export function Donut({
  segments,
  summary,
  size = 168,
  thickness = 18,
  centerLabel,
  centerValue,
  className,
}: DonutProps) {
  const palette = useChartPalette()
  const { locale } = useLocale()
  const [hovered, setHovered] = useState<string | null>(null)
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const gap = segments.length > 1 ? SEGMENT_GAP : 0
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
                  strokeWidth={hovered === segment.id ? thickness + HOVER_GROWTH : thickness}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  className="transition-all duration-d2 ease-out"
                  onMouseEnter={() => setHovered(segment.id)}
                  onMouseLeave={() => setHovered(null)}
                />
              )
            })
          : null}
        {centerValue ? (
          <text
            x={size / 2}
            y={size / 2 + (centerLabel ? VALUE_OFFSET_WITH_LABEL : VALUE_OFFSET_ALONE)}
            textAnchor="middle"
            fontSize={CENTER_VALUE_FONT_SIZE}
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
            y={size / 2 + CENTER_LABEL_OFFSET}
            textAnchor="middle"
            fontSize={CHART_LABEL_FONT_SIZE}
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
          return (
            <li key={segment.id}>
              <span className="flex w-full items-center gap-token-2 px-token-1 py-0.5">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-pill"
                  style={{ background: color }}
                />
                <span className="truncate text-token-13 text-console-ink-2">{segment.label}</span>
                <span className={cn("ml-auto text-token-13 text-console-ink", NUM_CLASS)}>
                  {formatCount(segment.value, locale, { compact: true })}
                </span>
                <span className={cn("w-9 text-right text-token-12 text-console-ink-3", NUM_CLASS)}>
                  {pct}%
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
