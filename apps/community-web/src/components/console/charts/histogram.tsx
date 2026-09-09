"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import {
  ChartKeyboardTwins,
  ChartSummary,
  ChartTooltip,
  formatCompact,
  NUM_CLASS,
  niceTicks,
  sparseIndices,
  useMeasuredWidth,
} from "./chart-utils"
import type { TooltipState } from "./chart-utils"
import { useChartPalette } from "./palette"

export interface HistogramBin {
  label: string
  count: number
}

export interface HistogramProps {
  bins: readonly HistogramBin[]
  summary: string
  valueLabel: string
  height?: number
  color?: string
  onBinPress?: (index: number) => void
  className?: string
}

const PAD = { top: 10, right: 8, bottom: 22, left: 34 }

export function Histogram({
  bins,
  summary,
  valueLabel,
  height = 160,
  color,
  onBinPress,
  className,
}: HistogramProps) {
  const palette = useChartPalette()
  const { ref, width } = useMeasuredWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TooltipState | null>(null)
  const fill = color ?? palette.hue.sky

  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom
  const maxValue = Math.max(1, ...bins.map((b) => b.count))
  const ticks = niceTicks(maxValue, 3)
  const tickMax = ticks[ticks.length - 1] ?? maxValue
  const slot = bins.length > 0 ? plotW / bins.length : 0
  const barW = Math.max(3, slot - 2)
  const yAt = (v: number) => PAD.top + plotH * (1 - v / tickMax)

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      <ChartSummary text={summary} />
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={summary}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={yAt(tick)}
                y2={yAt(tick)}
                stroke={palette.grid}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={yAt(tick) + 3}
                textAnchor="end"
                fontSize={11}
                fill={palette.label}
                className={NUM_CLASS}
              >
                {formatCompact(tick)}
              </text>
            </g>
          ))}
          {sparseIndices(bins.length).map((i) => (
            <text
              key={i}
              x={PAD.left + i * slot + slot / 2}
              y={height - 6}
              textAnchor="middle"
              fontSize={11}
              fill={palette.label}
            >
              {bins[i]?.label}
            </text>
          ))}
          {bins.map((bin, i) => {
            const x = PAD.left + i * slot + (slot - barW) / 2
            const y = yAt(bin.count)
            return (
              <rect
                key={`${bin.label}:${i}`}
                x={x}
                y={y}
                width={barW}
                height={Math.max(0, PAD.top + plotH - y)}
                rx={2}
                fill={fill}
                className={onBinPress ? "cursor-pointer" : undefined}
                onMouseEnter={() =>
                  setTip({
                    x: x + barW / 2,
                    y,
                    title: bin.label,
                    rows: [{ label: valueLabel, value: formatCompact(bin.count), color: fill }],
                  })
                }
                onMouseLeave={() => setTip(null)}
                onClick={() => onBinPress?.(i)}
              />
            )
          })}
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      <ChartTooltip tip={tip} />
      <ChartKeyboardTwins
        marks={
          onBinPress
            ? bins.map((bin, i) => ({
                key: `${bin.label}:${i}`,
                label: `${bin.label}: ${formatCompact(bin.count)}`,
                onSelect: () => onBinPress(i),
              }))
            : []
        }
      />
    </div>
  )
}
