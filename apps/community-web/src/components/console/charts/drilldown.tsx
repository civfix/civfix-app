"use client"

import { ChevronLeft } from "lucide-react"
import type { ReactNode } from "react"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

export interface DrilldownHeaderProps {
  title: string
  context?: string
  chips?: ReactNode
  onBack?: () => void
  className?: string
}

export function DrilldownHeader({
  title,
  context,
  chips,
  onBack,
  className,
}: DrilldownHeaderProps) {
  const { t } = useT("host-common")
  return (
    <header
      className={cn(
        "flex items-start gap-token-2 border-b border-console-line bg-console-surface px-token-4 py-token-3",
        className,
      )}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={t("action.back")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-console-ink-2 hover:bg-console-surface-alt focus-visible:outline-none focus-visible:shadow-console-ring"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-token-16 font-bold tracking-snugger text-console-ink">
          {title}
        </h3>
        {context ? <p className="mt-0.5 text-token-12 text-console-ink-3">{context}</p> : null}
        {chips ? (
          <div className="mt-token-1 flex flex-wrap items-center gap-token-1">{chips}</div>
        ) : null}
      </div>
    </header>
  )
}

export function DrilldownList({
  children,
  empty,
  className,
}: {
  children?: ReactNode
  empty?: ReactNode
  className?: string
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <div className={cn("flex flex-col divide-y divide-console-line overflow-y-auto", className)}>
      {hasChildren ? children : empty}
    </div>
  )
}
