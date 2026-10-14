"use client"

import { linePath, valueRuns } from "./chart-utils"
import { useChartPalette } from "./palette"

export interface SparklineProps {
  values: readonly (number | null)[]
  width?: number
  height?: number
  color?: string
  fill?: boolean
  label?: string
  className?: string
}

interface SparkPoint {
  x: number
  y: number
}

export function Sparkline({
  values,
  width = 96,
  height = 28,
  color,
  fill = true,
  label,
  className,
}: SparklineProps) {
  const palette = useChartPalette()
  const shown = values.filter((value): value is number => value !== null)
  if (values.length < 2 || shown.length < 2) return null
  const stroke = color ?? palette.hue.sky
  const max = Math.max(...shown, 1)
  const min = Math.min(...shown, 0)
  const range = max - min || 1
  const pad = 2
  const stepX = (width - pad * 2) / (values.length - 1)
  const at = (index: number, value: number): SparkPoint => ({
    x: pad + index * stepX,
    y: pad + (height - pad * 2) * (1 - (value - min) / range),
  })
  const runs = valueRuns(values)
  const lastRun = runs[runs.length - 1]
  const lastPoint = lastRun ? lastRun[lastRun.length - 1] : undefined
  const last = lastPoint ? at(lastPoint.index, lastPoint.value) : null

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
    >
      {runs.map((run) => {
        const points = run.map(({ index, value }) => at(index, value))
        const first = points[0]
        const tail = points[points.length - 1]
        if (first === undefined || tail === undefined) return null
        const key = `${run[0]?.index ?? 0}`
        if (points.length === 1) {
          return <circle key={key} cx={first.x} cy={first.y} r={1.5} fill={stroke} />
        }
        const line = linePath(points)
        return (
          <g key={key}>
            {fill ? (
              <path
                d={`${line} L${tail.x.toFixed(1)} ${height - pad} L${first.x.toFixed(1)} ${height - pad} Z`}
                fill={stroke}
                fillOpacity={0.12}
                stroke="none"
              />
            ) : null}
            <path
              d={line}
              fill="none"
              stroke={stroke}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )
      })}
      {last ? <circle cx={last.x} cy={last.y} r={2.5} fill={stroke} /> : null}
    </svg>
  )
}
