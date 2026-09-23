"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import {
  ChartKeyboardTwins,
  ChartLegend,
  ChartTooltip,
  formatCompact,
  NUM_CLASS,
  niceTicks,
  sparseIndices,
  useMeasuredWidth,
} from "./chart-utils"
import type { TooltipState } from "./chart-utils"
import { useChartPalette } from "./palette"

export interface StackedBarsSeries {
  id: string
  label: string
  values: readonly (number | null)[]
  color?: string
}

export interface StackedBarsProps {
  labels: readonly string[]
  series: readonly StackedBarsSeries[]
  summary: string
  suppressedLabel: string
  height?: number
  yFormat?: (value: number) => string
  onSegmentPress?: (seriesId: string, index: number) => void
  labelTarget?: number
  className?: string
}

const PAD = { top: 10, right: 12, bottom: 22, left: 40 }

export function StackedBars({
  labels,
  series,
  summary,
  suppressedLabel,
  height = 200,
  yFormat = formatCompact,
  onSegmentPress,
  labelTarget,
  className,
}: StackedBarsProps) {
  const palette = useChartPalette()
  const { ref, width } = useMeasuredWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TooltipState | null>(null)

  const count = labels.length
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom
  const totals = labels.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0))
  const suppressedAt = labels.map((_, i) => series.some((s) => s.values[i] === null))
  const maxValue = Math.max(1, ...totals)
  const ticks = niceTicks(maxValue, 4, { integer: true })
  const tickMax = ticks[ticks.length - 1] ?? maxValue
  const slot = count > 0 ? plotW / count : 0
  const barW = Math.max(4, Math.min(36, slot * 0.62))
  const yAt = (v: number) => PAD.top + plotH * (1 - v / tickMax)

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
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
                {yFormat(tick)}
              </text>
            </g>
          ))}
          {sparseIndices(count, labelTarget).map((i) => (
            <text
              key={i}
              x={PAD.left + i * slot + slot / 2}
              y={height - 6}
              textAnchor="middle"
              fontSize={11}
              fill={palette.label}
            >
              {labels[i]}
            </text>
          ))}
          {labels.map((label, i) => {
            let running = 0
            const x = PAD.left + i * slot + (slot - barW) / 2
            if (suppressedAt[i]) {
              return (
                <g key={`${label}:${i}`}>
                  <rect
                    x={x}
                    y={PAD.top + plotH - 6}
                    width={barW}
                    height={6}
                    rx={2}
                    fill={palette.grid}
                    onMouseEnter={() =>
                      setTip({
                        x: x + barW / 2,
                        y: PAD.top + plotH - 6,
                        title: label,
                        rows: [{ label: suppressedLabel, value: "\u2014" }],
                      })
                    }
                    onMouseLeave={() => setTip(null)}
                  />
                </g>
              )
            }
            return (
              <g key={`${label}:${i}`}>
                {series.map((s, si) => {
                  const value = s.values[i] ?? 0
                  if (value <= 0) return null
                  const y0 = yAt(running)
                  running += value
                  const y1 = yAt(running)
                  const segH = Math.max(0, y0 - y1 - 1)
                  const color = s.color ?? palette.seriesColor(si)
                  const isTop = running >= (totals[i] ?? 0)
                  return (
                    <rect
                      key={s.id}
                      x={x}
                      y={y1}
                      width={barW}
                      height={segH}
                      rx={isTop ? 3 : 1}
                      fill={color}
                      className={onSegmentPress ? "cursor-pointer" : undefined}
                      onMouseEnter={() =>
                        setTip({
                          x: x + barW / 2,
                          y: y1,
                          title: label,
                          rows: [{ label: s.label, value: yFormat(value), color }],
                        })
                      }
                      onMouseLeave={() => setTip(null)}
                      onClick={() => onSegmentPress?.(s.id, i)}
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>
      ) : (
        <div role="img" aria-label={summary} style={{ height }} />
      )}
      <ChartTooltip tip={tip} />
      <ChartKeyboardTwins
        marks={
          onSegmentPress
            ? labels.flatMap((label, i) =>
                series
                  .filter((s) => (s.values[i] ?? 0) > 0)
                  .map((s) => ({
                    key: `${s.id}:${i}`,
                    label: `${label} · ${s.label}: ${yFormat(s.values[i] as number)}`,
                    onSelect: () => onSegmentPress(s.id, i),
                  })),
              )
            : []
        }
      />
      <ChartLegend
        className="mt-token-2"
        items={series.map((s, si) => ({
          label: s.label,
          color: s.color ?? palette.seriesColor(si),
        }))}
      />
    </div>
  )
}
