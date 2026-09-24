"use client"

import { useMemo, useState } from "react"
import { UserPlus } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { CheckinResultDTO } from "@civfix/shared"
import { useApi, useHostCounters, useEventTicketTypes } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { useGate } from "@/components/console/query-state"
import { ConsoleButton } from "@/components/console/button"
import { EmptyState, LoadingState, StateGate } from "@/components/console/states"
import { Chip } from "@/components/console/chips/chip"
import { QRow } from "@/components/console/qrow"
import { Field } from "@/components/console/forms/field"
import { TextInput, Select } from "@/components/console/forms/inputs"
import { GuidedSheet } from "@/components/console/overlay/guided-sheet"
import { useConsoleToast } from "@/components/console/overlay/toast"
import { Donut, Histogram, KpiCell, StatStrip } from "@/components/console/charts"

import { useConsoleEvent } from "../console-context"
import { useConsoleErrors } from "../error-copy"
import { EMPTY_VALUE, useConsoleFormat } from "../format"
import { useConsoleRoster } from "../attendees/use-roster"
import { attendeeDisplayName, checkableSeatIds } from "../attendees/roster-filters"
import {
  invalidateCheckinCounters,
  invalidateEvent,
  markRosterSeatsCheckedIn,
} from "../console-invalidate"
import { formatTicketCode, normalizeTicketCode, ticketCodeReady } from "./ticket-code"

function ScanResultCard({ result, onDismiss }: { result: CheckinResultDTO; onDismiss: () => void }) {
  const { t } = useT("host-checkin")
  const tone =
    result.outcome === "checked_in"
      ? "moss"
      : result.outcome === "already"
        ? "sky"
        : result.outcome === "waitlisted"
          ? "sun"
          : "bloom"
  const toneClasses = {
    moss: "border-console-moss-strong/40 bg-console-moss-soft text-console-moss-strong",
    sky: "border-console-sky-strong/40 bg-console-sky-soft text-console-sky-strong",
    sun: "border-console-sun-strong/40 bg-console-sun-soft text-console-sun-strong",
    bloom: "border-console-bloom-strong/40 bg-console-bloom-soft text-console-bloom-strong",
  } as const
  return (
    <div
      role="status"
      className={`flex items-start gap-token-3 rounded-md border p-token-4 ${toneClasses[tone]}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-token-15 font-bold">{t(`result.${result.outcome}_title`)}</p>
        <p className="text-token-13">{t(`result.${result.outcome}_body`)}</p>
        {result.attendeeName ? (
          <p className="mt-token-1 text-token-14 font-semibold">{result.attendeeName}</p>
        ) : null}
        {result.ticketTypeName ? (
          <p className="text-token-12">{result.ticketTypeName}</p>
        ) : null}
      </div>
      <ConsoleButton variant="ghost" size="sm" onClick={onDismiss}>
        {t("result.dismiss")}
      </ConsoleButton>
    </div>
  )
}

export function CheckinScreen() {
  const { t } = useT("host-checkin")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const { eventId, event, can } = useConsoleEvent()
  const format = useConsoleFormat(event?.timezone ?? undefined)

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
  const rosterGate = useGate(roster)
  const rows = useMemo(
    () => (roster.data?.pages ?? []).flatMap((page) => page.items),
    [roster.data],
  )

  const [code, setCode] = useState("")
  const [result, setResult] = useState<CheckinResultDTO | null>(null)
  const [walkupOpen, setWalkupOpen] = useState(false)
  const [walkupName, setWalkupName] = useState("")
  const [walkupParty, setWalkupParty] = useState(1)
  const [walkupType, setWalkupType] = useState("")

  const refresh = () => invalidateEvent(qc, eventId)

  const scan = useMutation({
    mutationFn: (token: string) => api.scanEventTicket({ id: eventId, token }),
    onSuccess: (res) => {
      setResult(res)
      setCode("")
      refresh()
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  const checkInParty = useMutation({
    mutationFn: async (input: { seatIds: readonly string[]; registrationId: string }) => {
      const done: string[] = []
      let last: CheckinResultDTO | null = null
      let firstError: unknown = null
      for (const seatId of input.seatIds) {
        try {
          last = await api.checkInEventSeat({ id: eventId, seatId, method: "manual" })
          done.push(seatId)
        } catch (err) {
          if (firstError === null) firstError = err
        }
      }
      if (last === null) throw firstError
      return { result: last, done, firstError, registrationId: input.registrationId }
    },
    onSuccess: ({ result, done, firstError, registrationId }) => {
      setResult(result)
      markRosterSeatsCheckedIn(qc, eventId, registrationId, done, new Date().toISOString())
      invalidateCheckinCounters(qc, eventId)
      if (firstError !== null) {
        toast.toast({ title: errors.message(firstError), tone: "danger" })
      }
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  const walkup = useMutation({
    mutationFn: () =>
      api.createWalkupRegistration({
        id: eventId,
        name: walkupName.trim(),
        partySize: walkupParty,
        checkInNow: true,
        ...(walkupType ? { ticketTypeId: walkupType } : {}),
      }),
    onSuccess: (res) => {
      if (res.outcome === "registered" || res.outcome === "replayed") {
        toast.toast({ title: t("walkup.done", { name: walkupName.trim() }), tone: "success" })
        setWalkupOpen(false)
        setWalkupName("")
        setWalkupParty(1)
        setWalkupType("")
        refresh()
      } else {
        toast.toast({ title: t(`walkup.outcome_${res.outcome}`), tone: "danger" })
      }
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  const data = counters.data
  const arrivals = (data?.arrivals ?? []).map((bucket) => ({
    label: format.time(bucket.at),
    count: bucket.count,
  }))

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
          {data ? (
            <>
              <StatStrip>
                <KpiCell
                  size="strip"
                  label={t("counters.checked_in")}
                  value={format.number(data.checkedIn)}
                />
                <KpiCell
                  size="strip"
                  label={t("counters.registered")}
                  value={format.number(data.registered)}
                />
                <KpiCell
                  size="strip"
                  label={t("counters.waitlist")}
                  value={format.number(data.waitlisted)}
                  hot={data.waitlisted > 0}
                />
                <KpiCell
                  size="strip"
                  label={t("counters.no_show")}
                  value={format.number(data.noShow)}
                />
              </StatStrip>
              <p className="mt-token-2 text-token-12 text-console-ink-3">
                {t("counters.as_of", { time: format.time(data.asOf) })} · {t("counters.units")}
              </p>
            </>
          ) : null}
        </StateGate>
      </section>

      {result ? <ScanResultCard result={result} onDismiss={() => setResult(null)} /> : null}

      <section
        aria-labelledby="checkin-manual"
        className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1"
      >
        <h2
          id="checkin-manual"
          className="mb-token-3 font-display text-token-16 font-bold text-console-ink"
        >
          {t("manual.title")}
        </h2>
        <p className="mb-token-3 text-token-13 text-console-ink-3">{t("manual.hint")}</p>
        <form
          className="flex flex-wrap items-end gap-token-3"
          onSubmit={(event) => {
            event.preventDefault()
            const token = normalizeTicketCode(code)
            if (!ticketCodeReady(token)) return
            scan.mutate(token)
          }}
        >
          <Field label={t("manual.label")} className="min-w-[260px] flex-1">
            {({ id }) => (
              <TextInput
                id={id}
                value={code}
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                placeholder={t("manual.placeholder")}
                onBlur={() => setCode(formatTicketCode(code))}
                onChange={(event) => setCode(event.target.value)}
              />
            )}
          </Field>
          <ConsoleButton
            type="submit"
            disabled={scan.isPending || !ticketCodeReady(normalizeTicketCode(code))}
          >
            {t("manual.submit")}
          </ConsoleButton>
          <ConsoleButton variant="outline" onClick={() => setWalkupOpen(true)}>
            <UserPlus aria-hidden className="h-4 w-4" />
            {t("walkup.open")}
          </ConsoleButton>
        </form>
      </section>

      <section
        aria-labelledby="checkin-roster"
        className="rounded-md border border-console-line bg-console-surface shadow-console-1"
      >
        <div className="flex flex-wrap items-center justify-between gap-token-3 border-b border-console-line px-token-4 py-token-3">
          <h2
            id="checkin-roster"
            className="font-display text-token-16 font-bold text-console-ink"
          >
            {t("roster.title")}
          </h2>
          <TextInput
            leadingIcon="search"
            type="search"
            className="w-56"
            aria-label={t("roster.search")}
            placeholder={t("roster.search")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <StateGate
          {...rosterGate}
          onRetry={() => void roster.refetch()}
          skeleton={<LoadingState count={6} className="p-token-4" />}
          empty={rows.length === 0}
          emptyState={
            <div className="p-token-4">
              <EmptyState title={t("roster.empty_title")} body={t("roster.empty_body")} tone="moss" />
            </div>
          }
        >
          {rows.map((row) => {
            const seats = checkableSeatIds(row)
            const name = attendeeDisplayName(row, {
              guest: t("roster.guest"),
              deleted: t("roster.deleted"),
            })
            return (
              <QRow
                key={row.id}
                title={name}
                sub={`${row.ticketTypeName ?? EMPTY_VALUE} · ${format.number(row.seatCount)}`}
                chips={<Chip kind="attendee-kind" value={row.kind} size="sm" />}
                trailing={
                  can("check_in") && seats.length > 0 ? (
                    <ConsoleButton
                      size="sm"
                      variant="outline"
                      disabled={checkInParty.isPending}
                      onClick={() => checkInParty.mutate({ seatIds: seats, registrationId: row.id })}
                    >
                      {seats.length > 1
                        ? `${t("roster.check_in")} · ${t("result.party", { count: seats.length })}`
                        : t("roster.check_in")}
                    </ConsoleButton>
                  ) : null
                }
              />
            )
          })}
          {roster.hasNextPage ? (
            <div className="flex justify-center p-token-3">
              <ConsoleButton
                variant="outline"
                size="sm"
                disabled={roster.isFetchingNextPage}
                onClick={() => void roster.fetchNextPage()}
              >
                {roster.isFetchingNextPage ? tc("action.loading") : tc("action.load_more")}
              </ConsoleButton>
            </div>
          ) : null}
        </StateGate>
      </section>

      <section
        aria-labelledby="checkin-arrivals"
        className="grid gap-token-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      >
        <div className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1">
          <h2
            id="checkin-arrivals"
            className="mb-token-3 font-display text-token-16 font-bold text-console-ink"
          >
            {t("arrivals.title")}
          </h2>
          {arrivals.length === 0 ? (
            <p className="text-token-13 text-console-ink-3">{t("arrivals.empty")}</p>
          ) : (
            <Histogram
              bins={arrivals}
              summary={t("arrivals.a11y")}
              valueLabel={t("arrivals.value")}
            />
          )}
          <p className="mt-token-2 text-token-12 text-console-ink-3">{t("arrivals.buckets")}</p>
        </div>
        <div className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1">
          <h2 className="mb-token-3 font-display text-token-16 font-bold text-console-ink">
            {t("by_type.title")}
          </h2>
          {(data?.byTicketType.length ?? 0) === 0 ? (
            <p className="text-token-13 text-console-ink-3">{t("by_type.empty")}</p>
          ) : (
            <Donut
              summary={t("by_type.a11y")}
              size={140}
              centerValue={format.number(data?.checkedIn ?? 0)}
              centerLabel={t("counters.checked_in")}
              segments={(data?.byTicketType ?? []).map((row) => ({
                id: row.ticketTypeId,
                label: row.name,
                value: row.checkedIn,
              }))}
            />
          )}
        </div>
      </section>

      <GuidedSheet
        open={walkupOpen}
        onClose={() => setWalkupOpen(false)}
        title={t("walkup.title")}
        primaryLabel={t("walkup.submit")}
        primaryDisabled={walkupName.trim().length === 0 || walkup.isPending}
        onPrimary={() => walkup.mutate()}
        notice={<p className="text-token-13 text-console-ink-3">{t("walkup.notice")}</p>}
      >
        <div className="flex flex-col gap-token-3">
          <Field label={t("walkup.name")}>
            {({ id }) => (
              <TextInput
                id={id}
                value={walkupName}
                maxLength={80}
                onChange={(event) => setWalkupName(event.target.value)}
              />
            )}
          </Field>
          <Field label={t("walkup.party")}>
            {({ id }) => (
              <TextInput
                id={id}
                type="number"
                min={1}
                max={10}
                value={walkupParty}
                onChange={(event) =>
                  setWalkupParty(Math.min(10, Math.max(1, Number(event.target.value) || 1)))
                }
              />
            )}
          </Field>
          {(ticketTypes.data?.length ?? 0) > 0 ? (
            <Field label={t("walkup.ticket_type")} optional>
              {({ id }) => (
                <Select
                  id={id}
                  value={walkupType}
                  placeholder={t("walkup.ticket_placeholder")}
                  onChange={(event) => setWalkupType(event.target.value)}
                  options={(ticketTypes.data ?? []).map((type) => ({
                    value: type.id,
                    label: type.name,
                  }))}
                />
              )}
            </Field>
          ) : null}
        </div>
      </GuidedSheet>
    </div>
  )
}
