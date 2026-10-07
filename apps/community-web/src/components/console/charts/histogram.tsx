"use client"

import { useState } from "react"
import { formatCount } from "@civfix/shared"
import { useLocale } from "@civfix/ui/i18n"

import { ChartFrame, integerYAxis, XLabels, YGrid } from "./chart-frame"
import type { PlotPadding } from "./chart-frame"
import { useMeasuredWidth } from "./chart-utils"
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
  className?: string
}

const PAD: PlotPadding = { top: 10, right: 8, bottom: 22, left: 34 }
const TICK_COUNT = 3
const MIN_BAR_WIDTH = 3
const BAR_GAP = 2

export function Histogram({
  bins,
  summary,
  valueLabel,
  height = 160,
  color,
  className,
}: HistogramProps) {
  const palette = useChartPalette()
  const { locale } = useLocale()
  const { ref, width } = useMeasuredWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TooltipState | null>(null)
  const fill = color ?? palette.hue.sky

  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const axis = integerYAxis(Math.max(1, ...bins.map((b) => b.count)), TICK_COUNT, PAD, height)
  const slot = bins.length > 0 ? plotW / bins.length : 0
  const barW = Math.max(MIN_BAR_WIDTH, slot - BAR_GAP)

  return (
    <ChartFrame
      measureRef={ref}
      width={width}
      height={height}
      summary={summary}
      tip={tip}
      className={className}
    >
      <YGrid axis={axis} pad={PAD} width={width} palette={palette} />
      <XLabels
        labels={bins.map((bin) => bin.label)}
        xAt={(i) => PAD.left + i * slot + slot / 2}
        height={height}
        palette={palette}
      />
      {bins.map((bin, i) => {
        const x = PAD.left + i * slot + (slot - barW) / 2
        const y = axis.yAt(bin.count)
        return (
          <rect
            key={`${bin.label}:${i}`}
            x={x}
            y={y}
            width={barW}
            height={Math.max(0, PAD.top + axis.plotH - y)}
            rx={2}
            fill={fill}
            onMouseEnter={() =>
              setTip({
                x: x + barW / 2,
                y,
                title: bin.label,
                rows: [
                  {
                    label: valueLabel,
                    value: formatCount(bin.count, locale, { compact: true }),
                    color: fill,
                  },
                ],
              })
            }
            onMouseLeave={() => setTip(null)}
          />
        )
      })}
    </ChartFrame>
  )
}
