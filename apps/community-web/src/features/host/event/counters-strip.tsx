"use client"

import type { EventCheckinCountersDTO } from "@civfix/shared"
import { useT } from "@civfix/ui/i18n"

import { KpiCell, StatStrip } from "@/components/console/charts"

import type { ConsoleFormatters } from "../format"

export type CounterCell = "registered" | "checked_in" | "waitlist" | "no_show" | "capacity"

function CounterKpi({
  cell,
  counters,
  format,
  t,
}: {
  cell: CounterCell
  counters: EventCheckinCountersDTO
  format: ConsoleFormatters
  t: ReturnType<typeof useT>["t"]
}) {
  switch (cell) {
    case "registered":
      return (
        <KpiCell
          size="strip"
          label={t("counters.registered")}
          value={format.number(counters.registered)}
        />
      )
    case "checked_in":
      return (
        <KpiCell
          size="strip"
          label={t("counters.checked_in")}
          value={format.number(counters.checkedIn)}
        />
      )
    case "waitlist":
      return (
        <KpiCell
          size="strip"
          label={t("counters.waitlist")}
          value={format.number(counters.waitlisted)}
          hot={counters.waitlisted > 0}
        />
      )
    case "no_show":
      return (
        <KpiCell size="strip" label={t("counters.no_show")} value={format.number(counters.noShow)} />
      )
    case "capacity":
      return (
        <KpiCell
          size="strip"
          label={t("counters.capacity")}
          value={
            counters.capacity === null ? t("counters.unlimited") : format.number(counters.capacity)
          }
        />
      )
  }
}

/**
 * The live seat counters strip shared by the event overview and the door screen. Each screen keeps
 * its own copy namespace and cell order, so both are passed in.
 */
export function CountersStrip({
  counters,
  cells,
  namespace,
  format,
  className,
}: {
  counters: EventCheckinCountersDTO
  cells: readonly CounterCell[]
  namespace: "host-event" | "host-checkin"
  format: ConsoleFormatters
  className?: string
}) {
  const { t } = useT(namespace)
  return (
    <>
      <StatStrip className={className}>
        {cells.map((cell) => (
          <CounterKpi key={cell} cell={cell} counters={counters} format={format} t={t} />
        ))}
      </StatStrip>
      <p className="mt-token-2 text-token-12 text-console-ink-3">
        {t("counters.as_of", { time: format.time(counters.asOf) })} · {t("counters.units")}
      </p>
    </>
  )
}
