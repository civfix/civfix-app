"use client"

import { useState } from "react"
import type { MouseEvent } from "react"

import { cn } from "@/lib/utils"

import {
  ChartKeyboardTwins,
  ChartLegend,
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

export interface LineAreaSeries {
  id: string
  label: string
  values: readonly (number | null)[]
  color?: string
}

export interface LineAreaProps {
  labels: readonly string[]
  series: readonly LineAreaSeries[]
  summary: string
  suppressedLabel: string
  height?: number
  area?: boolean
  yFormat?: (value: number) => string
  onPointPress?: (index: number) => void
  className?: string
}

const PAD = { top: 10, right: 12, bottom: 22, left: 40 }

interface RunPoint {
  index: number
  value: number
}

function runsOf(values: readonly (number | null)[]): RunPoint[][] {
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

export function LineArea({
  labels,
  series,
  summary,
  suppressedLabel,
  height = 200,
  area = false,
  yFormat = formatCompact,
  onPointPress,
  className,
}: LineAreaProps) {
  const palette = useChartPalette()
  const { ref, width } = useMeasuredWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const [tip, setTip] = useState<TooltipState | null>(null)

  const count = labels.length
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom
  const maxValue = Math.max(
    1,
    ...series.flatMap((s) => s.values.filter((v): v is number => v !== null)),
  )
  const ticks = niceTicks(maxValue)
  const tickMax = ticks[ticks.length - 1] ?? maxValue
  const xAt = (i: number) => PAD.left + (count <= 1 ? plotW / 2 : (i / (count - 1)) * plotW)
  const yAt = (v: number) => PAD.top + plotH * (1 - v / tickMax)

  const handleMove = (event: MouseEvent<SVGSVGElement>) => {
    if (count === 0 || plotW <= 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const ratio = Math.min(1, Math.max(0, (x - PAD.left) / plotW))
    const index = Math.round(ratio * (count - 1))
    setHover(index)
    setTip({
      x: xAt(index),
      y: PAD.top,
      title: labels[index] ?? "",
      rows: series.map((s, si) => ({
        label: s.label,
        value: s.values[index] === null || s.values[index] === undefined
          ? suppressedLabel
          : yFormat(s.values[index] as number),
        color: s.color ?? palette.seriesColor(si),
      })),
    })
  }

  const clearHover = () => {
    setHover(null)
    setTip(null)
  }

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
          onMouseMove={handleMove}
          onMouseLeave={clearHover}
          onClick={() => {
            if (hover !== null) onPointPress?.(hover)
          }}
          className={onPointPress ? "cursor-pointer" : undefined}
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
          {sparseIndices(count).map((i) => (
            <text
              key={i}
              x={xAt(i)}
              y={height - 6}
              textAnchor="middle"
              fontSize={11}
              fill={palette.label}
            >
              {labels[i]}
            </text>
          ))}
          {series.map((s, si) => {
            const color = s.color ?? palette.seriesColor(si)
            return (
              <g key={s.id}>
                {runsOf(s.values).map((run) => {
                  const line = run
                    .map(
                      ({ index, value }, i) =>
                        `${i === 0 ? "M" : "L"}${xAt(index).toFixed(1)} ${yAt(value).toFixed(1)}`,
                    )
                    .join(" ")
                  const first = run[0]
                  const last = run[run.length - 1]
                  const areaPath =
                    first && last
                      ? `${line} L${xAt(last.index).toFixed(1)} ${yAt(0)} L${xAt(first.index).toFixed(1)} ${yAt(0)} Z`
                      : ""
                  return (
                    <g key={`${s.id}:${first?.index ?? 0}`}>
                      {area && areaPath ? (
                        <path d={areaPath} fill={color} fillOpacity={0.1} stroke="none" />
                      ) : null}
                      {run.length === 1 && first ? (
                        <circle cx={xAt(first.index)} cy={yAt(first.value)} r={2.5} fill={color} />
                      ) : (
                        <path
                          d={line}
                          fill="none"
                          stroke={color}
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                    </g>
                  )
                })}
              </g>
            )
          })}
          {hover !== null ? (
            <g>
              <line
                x1={xAt(hover)}
                x2={xAt(hover)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke={palette.axis}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {series.map((s, si) => {
                const value = s.values[hover]
                if (value === null || value === undefined) return null
                return (
                  <circle
                    key={s.id}
                    cx={xAt(hover)}
                    cy={yAt(value)}
                    r={4}
                    fill={s.color ?? palette.seriesColor(si)}
                    stroke={palette.surface}
                    strokeWidth={2}
                  />
                )
              })}
            </g>
          ) : null}
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      <ChartTooltip tip={tip} />
      <ChartKeyboardTwins
        marks={
          onPointPress
            ? labels.map((label, i) => ({
                key: `${label}:${i}`,
                label: `${label}: ${series
                  .map(
                    (s) =>
                      `${s.label} ${
                        s.values[i] === null || s.values[i] === undefined
                          ? suppressedLabel
                          : yFormat(s.values[i] as number)
                      }`,
                  )
                  .join(", ")}`,
                onSelect: () => onPointPress(i),
              }))
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
