"use client"

import { useT } from "@civfix/ui/i18n"

import { useConsoleFormat } from "../format"

export interface AnalyticsValueProps {
  value: number | null
  kind?: "count" | "rate"
  k?: number
}

export function AnalyticsValue({ value, kind = "count", k = 5 }: AnalyticsValueProps) {
  const { t } = useT("host-analytics")
  const format = useConsoleFormat()
  if (value === null) {
    const label = t("suppressed.explain", { k })
    return (
      <span className="text-console-ink-3" title={label} aria-label={label}>
        &mdash;
      </span>
    )
  }
  return <>{kind === "rate" ? format.percent(value) : format.number(value)}</>
}

export function SuppressionNote({ k = 5 }: { k?: number }) {
  const { t } = useT("host-analytics")
  return (
    <p className="mt-token-2 text-token-12 text-console-ink-3">{t("suppressed.note", { k })}</p>
  )
}

export function PanelSuppressed({ k = 5 }: { k?: number }) {
  const { t } = useT("host-analytics")
  return (
    <p
      role="status"
      className="rounded-sm border border-dashed border-console-line bg-console-surface-alt/50 px-token-4 py-token-4 text-token-13 text-console-ink-3"
    >
      {t("suppressed.panel", { k })}
    </p>
  )
}
