"use client"

import { cn } from "@/lib/utils"

import { ChartSummary, NUM_CLASS } from "./chart-utils"

export type FunnelTone = "neutral" | "sky" | "moss" | "sun" | "bloom"

export interface FunnelStage {
  id: string
  label: string
  value: string
  tone?: FunnelTone
}

export interface FunnelRibbonProps {
  stages: readonly FunnelStage[]
  summary: string
  activeId?: string | null
  onStagePress?: (id: string) => void
  className?: string
}

const TONE_CLASS: Record<FunnelTone, string> = {
  neutral: "bg-console-surface-alt text-console-ink-2",
  sky: "bg-console-sky-soft text-console-sky-strong",
  moss: "bg-console-moss-soft text-console-moss-strong",
  sun: "bg-console-sun-soft text-console-sun-strong",
  bloom: "bg-console-bloom-soft text-console-bloom-strong",
}

const NOTCH = 10

export function FunnelRibbon({
  stages,
  summary,
  activeId,
  onStagePress,
  className,
}: FunnelRibbonProps) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <ChartSummary text={summary} />
      <div className="flex min-w-max items-stretch gap-0.5" role="group" aria-label={summary}>
        {stages.map((stage, i) => {
          const tone = stage.tone ?? "neutral"
          const first = i === 0
          const last = i === stages.length - 1
          const clip = `polygon(0 0, calc(100% - ${last ? 0 : NOTCH}px) 0, 100% 50%, calc(100% - ${last ? 0 : NOTCH}px) 100%, 0 100%, ${first ? 0 : NOTCH}px 50%)`
          return (
            <button
              key={stage.id}
              type="button"
              disabled={!onStagePress}
              aria-pressed={onStagePress ? activeId === stage.id : undefined}
              onClick={() => onStagePress?.(stage.id)}
              className={cn(
                "flex min-h-11 min-w-24 flex-col items-center justify-center px-token-4 py-token-1 transition-opacity duration-d1 ease-out motion-reduce:transition-none",
                TONE_CLASS[tone],
                onStagePress && "cursor-pointer hover:opacity-85",
                activeId === stage.id && "shadow-console-ring",
                first && "rounded-l-sm",
                last && "rounded-r-sm",
              )}
              style={{ clipPath: clip }}
            >
              <span className={cn("text-token-16 font-bold leading-tight", NUM_CLASS)}>
                {stage.value}
              </span>
              <span className="text-token-12 leading-tight opacity-90">{stage.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
