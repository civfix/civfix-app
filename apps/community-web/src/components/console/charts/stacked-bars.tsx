"use client"

import { useState } from "react"
import { EMPTY_VALUE } from "@civfix/ui/i18n"

import { ChartFrame, integerYAxis, PLOT_PAD, XLabels, YGrid } from "./chart-frame"
import { formatCompact, useMeasuredWidth } from "./chart-utils"
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
  className?: string
}

const TICK_COUNT = 4
const MIN_BAR_WIDTH = 4
const MAX_BAR_WIDTH = 36
const BAR_SLOT_FILL = 0.62
const SUPPRESSED_STUB_HEIGHT = 6

export function StackedBars({
  labels,
  series,
  summary,
  suppressedLabel,
  height = 200,
  className,
}: StackedBarsProps) {
  const palette = useChartPalette()
  const { ref, width } = useMeasuredWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TooltipState | null>(null)

  const count = labels.length
  const plotW = Math.max(0, width - PLOT_PAD.left - PLOT_PAD.right)
  const totals = labels.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0))
  const suppressedAt = labels.map((_, i) => series.some((s) => s.values[i] === null))
  const axis = integerYAxis(Math.max(1, ...totals), TICK_COUNT, PLOT_PAD, height)
  const { plotH, yAt } = axis
  const slot = count > 0 ? plotW / count : 0
  const barW = Math.max(MIN_BAR_WIDTH, Math.min(MAX_BAR_WIDTH, slot * BAR_SLOT_FILL))

  return (
    <ChartFrame
      measureRef={ref}
      width={width}
      height={height}
      summary={summary}
      tip={tip}
      legend={series.map((s, si) => ({
        label: s.label,
        color: s.color ?? palette.seriesColor(si),
      }))}
      className={className}
    >
      <YGrid axis={axis} pad={PLOT_PAD} width={width} palette={palette} />
      <XLabels
        labels={labels}
        xAt={(i) => PLOT_PAD.left + i * slot + slot / 2}
        height={height}
        palette={palette}
      />
      {labels.map((label, i) => {
        let running = 0
        const x = PLOT_PAD.left + i * slot + (slot - barW) / 2
        if (suppressedAt[i]) {
          const stubY = PLOT_PAD.top + plotH - SUPPRESSED_STUB_HEIGHT
          return (
            <g key={`${label}:${i}`}>
              <rect
                x={x}
                y={stubY}
                width={barW}
                height={SUPPRESSED_STUB_HEIGHT}
                rx={2}
                fill={palette.grid}
                onMouseEnter={() =>
                  setTip({
                    x: x + barW / 2,
                    y: stubY,
                    title: label,
                    rows: [{ label: suppressedLabel, value: EMPTY_VALUE }],
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
                  onMouseEnter={() =>
                    setTip({
                      x: x + barW / 2,
                      y: y1,
                      title: label,
                      rows: [{ label: s.label, value: formatCompact(value), color }],
                    })
                  }
                  onMouseLeave={() => setTip(null)}
                />
              )
            })}
          </g>
        )
      })}
    </ChartFrame>
  )
}
