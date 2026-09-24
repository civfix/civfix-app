"use client"

import { useState } from "react"
import { formatCount } from "@civfix/shared"
import { useLocale } from "@civfix/ui/i18n"
import type { MouseEvent } from "react"

import { ChartFrame, integerYAxis, PLOT_PAD, XLabels, YGrid } from "./chart-frame"
import { linePath, useMeasuredWidth, valueRuns } from "./chart-utils"
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
  className?: string
}

const TICK_COUNT = 4
const AREA_OPACITY = 0.1
const LONE_POINT_RADIUS = 2.5
const HOVER_POINT_RADIUS = 4

export function LineArea({
  labels,
  series,
  summary,
  suppressedLabel,
  height = 200,
  area = false,
  className,
}: LineAreaProps) {
  const palette = useChartPalette()
  const { locale } = useLocale()
  const { ref, width } = useMeasuredWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const [tip, setTip] = useState<TooltipState | null>(null)

  const count = labels.length
  const plotW = Math.max(0, width - PLOT_PAD.left - PLOT_PAD.right)
  const maxValue = Math.max(
    1,
    ...series.flatMap((s) => s.values.filter((v): v is number => v !== null)),
  )
  const axis = integerYAxis(maxValue, TICK_COUNT, PLOT_PAD, height)
  const { plotH, yAt } = axis
  const xAt = (i: number) =>
    PLOT_PAD.left + (count <= 1 ? plotW / 2 : (i / (count - 1)) * plotW)

  const handleMove = (event: MouseEvent<SVGSVGElement>) => {
    if (count === 0 || plotW <= 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const ratio = Math.min(1, Math.max(0, (x - PLOT_PAD.left) / plotW))
    const index = Math.round(ratio * (count - 1))
    setHover(index)
    setTip({
      x: xAt(index),
      y: PLOT_PAD.top,
      title: labels[index] ?? "",
      rows: series.map((s, si) => ({
        label: s.label,
        value: s.values[index] === null || s.values[index] === undefined
          ? suppressedLabel
          : formatCount(s.values[index] as number, locale, { compact: true }),
        color: s.color ?? palette.seriesColor(si),
      })),
    })
  }

  const clearHover = () => {
    setHover(null)
    setTip(null)
  }

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
      onMouseMove={handleMove}
      onMouseLeave={clearHover}
      className={className}
    >
      <YGrid axis={axis} pad={PLOT_PAD} width={width} palette={palette} />
      <XLabels labels={labels} xAt={xAt} height={height} palette={palette} />
      {series.map((s, si) => {
        const color = s.color ?? palette.seriesColor(si)
        return (
          <g key={s.id}>
            {valueRuns(s.values).map((run) => {
              const line = linePath(run.map(({ index, value }) => ({ x: xAt(index), y: yAt(value) })))
              const first = run[0]
              const last = run[run.length - 1]
              const areaPath =
                first && last
                  ? `${line} L${xAt(last.index).toFixed(1)} ${yAt(0)} L${xAt(first.index).toFixed(1)} ${yAt(0)} Z`
                  : ""
              return (
                <g key={`${s.id}:${first?.index ?? 0}`}>
                  {area && areaPath ? (
                    <path d={areaPath} fill={color} fillOpacity={AREA_OPACITY} stroke="none" />
                  ) : null}
                  {run.length === 1 && first ? (
                    <circle
                      cx={xAt(first.index)}
                      cy={yAt(first.value)}
                      r={LONE_POINT_RADIUS}
                      fill={color}
                    />
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
            y1={PLOT_PAD.top}
            y2={PLOT_PAD.top + plotH}
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
                r={HOVER_POINT_RADIUS}
                fill={s.color ?? palette.seriesColor(si)}
                stroke={palette.surface}
                strokeWidth={2}
              />
            )
          })}
        </g>
      ) : null}
    </ChartFrame>
  )
}
