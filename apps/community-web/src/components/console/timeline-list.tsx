"use client"

import { Lock } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

export interface TimelineEntry {
  id: string
  at: string
  atLabel: string
  actorLabel?: string
  body: ReactNode
  note?: string | null
  internal?: boolean
}

export interface TimelineListProps {
  entries: readonly TimelineEntry[]
  limit?: number
  collapsible?: boolean
  initialCount?: number
  className?: string
}

export function TimelineList({
  entries,
  limit,
  collapsible,
  initialCount = 5,
  className,
}: TimelineListProps) {
  const { t } = useT("host-common")
  const [expanded, setExpanded] = useState(false)
  const capped = limit ? entries.slice(0, limit) : entries
  const collapseAt = collapsible && !expanded ? initialCount : capped.length
  const shown = capped.slice(0, collapseAt)
  const hidden = capped.length - shown.length
  return (
    <ol className={cn("flex flex-col", className)}>
      {shown.map((entry) => (
        <li
          key={entry.id}
          className="flex items-baseline gap-token-2 border-b border-console-line py-token-2 last:border-b-0"
        >
          <time
            dateTime={entry.at}
            className="w-20 shrink-0 font-mono text-token-12 text-console-ink-3"
          >
            {entry.atLabel}
          </time>
          <span className="min-w-0 flex-1 text-token-13 text-console-ink-2">
            {entry.actorLabel ? (
              <span className="font-semibold text-console-ink">{entry.actorLabel} </span>
            ) : null}
            {entry.body}
            {entry.note ? (
              <span className="text-console-ink-3">{` "${entry.note}"`}</span>
            ) : null}
          </span>
          {entry.internal ? (
            <span title={t("timeline.internal")} className="shrink-0 self-center">
              <Lock aria-hidden className="h-3 w-3 text-console-ink-3" />
              <span className="sr-only">{t("timeline.internal")}</span>
            </span>
          ) : null}
        </li>
      ))}
      {collapsible && (hidden > 0 || expanded) ? (
        <li className="py-token-2">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-xs text-token-12 font-semibold text-console-sky-strong underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-console-ring"
          >
            {expanded ? t("timeline.show_less") : t("timeline.show_more", { count: hidden })}
          </button>
        </li>
      ) : null}
    </ol>
  )
}
