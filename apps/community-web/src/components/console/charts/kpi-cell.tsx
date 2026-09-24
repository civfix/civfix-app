"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import { NUM_CLASS } from "./chart-utils"

export interface KpiCellProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  size?: "card" | "strip"
  hot?: boolean
  className?: string
}

export function KpiCell({
  label,
  value,
  sub,
  size = "card",
  hot = false,
  className,
}: KpiCellProps) {
  const strip = size === "strip"
  const base = strip
    ? cn(
        "flex h-full min-h-11 min-w-24 flex-col items-start justify-center px-token-4",
        hot && "bg-console-bloom-soft",
      )
    : "flex flex-col items-start gap-token-1 rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1"

  return (
    <div className={cn(base, className)}>
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
    </div>
  )
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
