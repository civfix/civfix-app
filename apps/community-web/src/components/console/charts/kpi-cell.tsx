"use client"

import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import { NUM_CLASS } from "./chart-utils"
import { Sparkline } from "./sparkline"

export interface KpiDelta {
  label: string
  direction: "up" | "down"
  good?: boolean
}

export interface KpiCellProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  delta?: KpiDelta
  spark?: readonly number[]
  size?: "card" | "strip"
  hot?: boolean
  onPress?: () => void
  className?: string
}

function DeltaPill({ delta }: { delta: KpiDelta }) {
  const Icon = delta.direction === "up" ? ArrowUpRight : ArrowDownRight
  const good = delta.good ?? delta.direction === "up"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-pill px-token-1 py-px text-token-12 font-semibold",
        good
          ? "bg-console-moss-soft text-console-moss-strong"
          : "bg-console-bloom-soft text-console-bloom-strong",
        NUM_CLASS,
      )}
    >
      <Icon aria-hidden className="h-3 w-3" />
      {delta.label}
    </span>
  )
}

export function KpiCell({
  label,
  value,
  sub,
  delta,
  spark,
  size = "card",
  hot = false,
  onPress,
  className,
}: KpiCellProps) {
  const strip = size === "strip"
  const body = (
    <>
      <span className="flex items-baseline gap-token-2">
        <span
          className={cn(
            "font-bold text-console-ink",
            strip ? "text-token-16" : "text-token-24",
            hot && "text-console-bloom-strong",
            NUM_CLASS,
          )}
        >
          {value}
        </span>
        {delta ? <DeltaPill delta={delta} /> : null}
      </span>
      {strip ? (
        <span className="flex items-center gap-token-2 text-token-12 leading-tight text-console-ink-3">
          {label}
          {sub ? <span className="text-console-ink-3">{sub}</span> : null}
        </span>
      ) : (
        <span className="flex min-w-0 flex-col text-token-12 text-console-ink-3">
          <span>{label}</span>
          {sub ? <span>{sub}</span> : null}
        </span>
      )}
      {spark && !strip ? (
        <Sparkline values={spark} width={112} height={26} className="mt-token-1" />
      ) : null}
    </>
  )
  const base = strip
    ? cn(
        "flex h-full min-h-11 min-w-24 flex-col items-start justify-center px-token-4",
        hot && "bg-console-bloom-soft",
      )
    : "flex flex-col items-start gap-token-1 rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1"

  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        className={cn(
          base,
          "text-left transition-colors duration-d1 ease-out hover:bg-console-surface-alt focus-visible:outline-none focus-visible:shadow-console-ring motion-reduce:transition-none",
          className,
        )}
      >
        {body}
      </button>
    )
  }
  return <div className={cn(base, className)}>{body}</div>
}

export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-11 items-stretch divide-x divide-console-line overflow-x-auto rounded-sm border border-console-line bg-console-surface shadow-console-1",
        className,
      )}
    >
      {children}
    </div>
  )
}
