"use client"

import type { MouseEvent, ReactNode, RefObject } from "react"

import { cn } from "@/lib/utils"

import {
  CHART_LABEL_FONT_SIZE,
  ChartLegend,
  ChartTooltip,
  formatCompact,
  NUM_CLASS,
  niceTicks,
  sparseIndices,
} from "./chart-utils"
import type { LegendItem, TooltipState } from "./chart-utils"
import type { ChartPalette } from "./palette"

const AXIS_LABEL_GAP = 6
const TICK_LABEL_BASELINE = 3

export interface PlotPadding {
  top: number
  right: number
  bottom: number
  left: number
}

export const PLOT_PAD: PlotPadding = { top: 10, right: 12, bottom: 22, left: 40 }

export interface YAxis {
  ticks: number[]
  plotH: number
  yAt: (value: number) => number
}

export function integerYAxis(
  maxValue: number,
  tickCount: number,
  pad: PlotPadding,
  height: number,
): YAxis {
  const ticks = niceTicks(maxValue, tickCount, { integer: true })
  const tickMax = ticks[ticks.length - 1] ?? maxValue
  const plotH = height - pad.top - pad.bottom
  return { ticks, plotH, yAt: (value: number) => pad.top + plotH * (1 - value / tickMax) }
}

export function YGrid({
  axis,
  pad,
  width,
  palette,
}: {
  axis: YAxis
  pad: PlotPadding
  width: number
  palette: ChartPalette
}) {
  return (
    <>
      {axis.ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={axis.yAt(tick)}
            y2={axis.yAt(tick)}
            stroke={palette.grid}
            strokeWidth={1}
          />
          <text
            x={pad.left - AXIS_LABEL_GAP}
            y={axis.yAt(tick) + TICK_LABEL_BASELINE}
            textAnchor="end"
            fontSize={CHART_LABEL_FONT_SIZE}
            fill={palette.label}
            className={NUM_CLASS}
          >
            {formatCompact(tick)}
          </text>
        </g>
      ))}
    </>
  )
}

export function XLabels({
  labels,
  xAt,
  height,
  palette,
}: {
  labels: readonly string[]
  xAt: (index: number) => number
  height: number
  palette: ChartPalette
}) {
  return (
    <>
      {sparseIndices(labels.length).map((i) => (
        <text
          key={i}
          x={xAt(i)}
          y={height - AXIS_LABEL_GAP}
          textAnchor="middle"
          fontSize={CHART_LABEL_FONT_SIZE}
          fill={palette.label}
        >
          {labels[i]}
        </text>
      ))}
    </>
  )
}

export interface ChartFrameProps {
  measureRef: RefObject<HTMLDivElement | null>
  width: number
  height: number
  summary: string
  tip: TooltipState | null
  legend?: LegendItem[]
  onMouseMove?: (event: MouseEvent<SVGSVGElement>) => void
  onMouseLeave?: () => void
  className?: string
  children: ReactNode
}

// Before the first measure there is no width to draw at, but the placeholder still carries the
// summary so the chart is never nameless to a screen reader.
export function ChartFrame({
  measureRef,
  width,
  height,
  summary,
  tip,
  legend,
  onMouseMove,
  onMouseLeave,
  className,
  children,
}: ChartFrameProps) {
  return (
    <div ref={measureRef} className={cn("relative w-full", className)}>
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={summary}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        >
          {children}
        </svg>
      ) : (
        <div role="img" aria-label={summary} style={{ height }} />
      )}
      <ChartTooltip tip={tip} />
      {legend ? <ChartLegend className="mt-token-2" items={legend} /> : null}
    </div>
  )
}
