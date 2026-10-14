"use client"

import { useMemo, useState } from "react"
import type { CheckinResultDTO } from "@civfix/shared"
import { useHostCounters, useEventTicketTypes } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { useGate } from "@/components/console/query-state"
import { LoadingState, StateGate } from "@/components/console/states"

import { useConsoleEvent } from "../console-context"
import { useConsoleFormat } from "../format"
import { useConsoleRoster } from "../attendees/use-roster"
import { CountersStrip, type CounterCell } from "../event/counters-strip"
import {
  CheckinCharts,
  DoorRoster,
  ManualCheckinForm,
  ScanResultCard,
  WalkupSheet,
} from "./checkin-sections"

const DOOR_COUNTER_CELLS: readonly CounterCell[] = ["checked_in", "registered", "waitlist", "no_show"]

export function CheckinScreen() {
  const { t } = useT("host-checkin")
  const { eventId, event, can } = useConsoleEvent()
  const format = useConsoleFormat(event.timezone ?? undefined)

  const counters = useHostCounters(eventId)
  const countersGate = useGate(counters)
  const ticketTypes = useEventTicketTypes(eventId)

  const [search, setSearch] = useState("")
  const roster = useConsoleRoster({
    eventId,
    filter: "not_checked_in",
    sort: "name_asc",
    q: search,
    ticketTypeId: null,
  })
  const rows = useMemo(
    () => (roster.data?.pages ?? []).flatMap((page) => page.items),
    [roster.data],
  )

  const [result, setResult] = useState<CheckinResultDTO | null>(null)
  const [walkupOpen, setWalkupOpen] = useState(false)

  return (
    <div className="flex flex-col gap-token-5">
      <section aria-labelledby="checkin-counters">
        <h2 id="checkin-counters" className="sr-only">
          {t("counters.heading")}
        </h2>
        <StateGate
          {...countersGate}
          onRetry={() => void counters.refetch()}
          skeleton={<LoadingState shape="kpi" count={1} />}
        >
          {counters.data ? (
            <CountersStrip
              counters={counters.data}
              cells={DOOR_COUNTER_CELLS}
              namespace="host-checkin"
              format={format}
            />
          ) : null}
        </StateGate>
      </section>

      {result ? <ScanResultCard result={result} onDismiss={() => setResult(null)} /> : null}

      <ManualCheckinForm
        eventId={eventId}
        onResult={setResult}
        onOpenWalkup={() => setWalkupOpen(true)}
      />

      <DoorRoster
        eventId={eventId}
        roster={roster}
        rows={rows}
        search={search}
        onSearchChange={setSearch}
        canCheckIn={can("check_in")}
        format={format}
        onResult={setResult}
      />

      <CheckinCharts counters={counters.data} format={format} />

      <WalkupSheet
        eventId={eventId}
        open={walkupOpen}
        onClose={() => setWalkupOpen(false)}
        ticketTypes={ticketTypes.data ?? []}
      />
    </div>
  )
}
