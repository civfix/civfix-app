"use client"

import { useState } from "react"
import { UserPlus } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  MAX_ATTENDEE_NAME,
  MAX_PARTY_SIZE,
  type CheckinResultDTO,
  type EventCheckinCountersDTO,
  type EventRegistrationDTO,
} from "@civfix/shared"
import {
  attendeeDisplayName,
  checkableSeatIds,
  checkinResultRender,
  formatTicketCode,
  normalizeTicketCode,
  ticketCodeReady,
  type CheckinTone,
} from "@civfix/shared/host"
import { useApi } from "@civfix/ui/data"
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
import { Donut, Histogram } from "@/components/console/charts"

import { useConsoleErrors } from "../error-copy"
import { EMPTY_VALUE, type ConsoleFormatters } from "../format"
import { checkInSeats } from "../attendees/check-in-seats"
import type { useConsoleRoster } from "../attendees/use-roster"
import {
  invalidateCheckinCounters,
  invalidateEvent,
  markRosterSeatsCheckedIn,
} from "../console-invalidate"

const WALKUP_MIN_PARTY = 1

const TONE_CLASSES: Record<CheckinTone, string> = {
  success: "border-console-moss-strong/40 bg-console-moss-soft text-console-moss-strong",
  warning: "border-console-sun-strong/40 bg-console-sun-soft text-console-sun-strong",
  error: "border-console-bloom-strong/40 bg-console-bloom-soft text-console-bloom-strong",
}

const PANEL_CLASS =
  "rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1"
const PANEL_HEADING_CLASS = "mb-token-3 font-display text-token-16 font-bold text-console-ink"

export function ScanResultCard({
  result,
  onDismiss,
}: {
  result: CheckinResultDTO
  onDismiss: () => void
}) {
  const { t } = useT("host-checkin")
  const render = checkinResultRender(result.outcome, result.firstTime)
  return (
    <div
      role="status"
      className={`flex items-start gap-token-3 rounded-md border p-token-4 ${TONE_CLASSES[render.tone]}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-token-15 font-bold">{t(render.titleKey)}</p>
        <p className="text-token-13">{t(render.bodyKey)}</p>
        {result.attendeeName ? (
          <p className="mt-token-1 text-token-14 font-semibold">{result.attendeeName}</p>
        ) : null}
        {result.ticketTypeName ? <p className="text-token-12">{result.ticketTypeName}</p> : null}
      </div>
      <ConsoleButton variant="ghost" size="sm" onClick={onDismiss}>
        {t("result.dismiss")}
      </ConsoleButton>
    </div>
  )
}

export function ManualCheckinForm({
  eventId,
  onResult,
  onOpenWalkup,
}: {
  eventId: string
  onResult: (result: CheckinResultDTO) => void
  onOpenWalkup: () => void
}) {
  const { t } = useT("host-checkin")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const [code, setCode] = useState("")

  const scan = useMutation({
    mutationFn: (token: string) => api.scanEventTicket({ id: eventId, token }),
    onSuccess: (res) => {
      onResult(res)
      setCode("")
      invalidateEvent(qc, eventId)
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  return (
    <section aria-labelledby="checkin-manual" className={PANEL_CLASS}>
      <h2 id="checkin-manual" className={PANEL_HEADING_CLASS}>
        {t("manual.title")}
      </h2>
      <p className="mb-token-3 text-token-13 text-console-ink-3">{t("manual.hint")}</p>
      <form
        className="flex flex-wrap items-end gap-token-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!ticketCodeReady(code)) return
          scan.mutate(normalizeTicketCode(code))
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
          disabled={scan.isPending || !ticketCodeReady(code)}
        >
          {t("manual.submit")}
        </ConsoleButton>
        <ConsoleButton variant="outline" onClick={onOpenWalkup}>
          <UserPlus aria-hidden className="h-4 w-4" />
          {t("walkup.open")}
        </ConsoleButton>
      </form>
    </section>
  )
}

export function DoorRoster({
  eventId,
  roster,
  rows,
  search,
  onSearchChange,
  canCheckIn,
  format,
  onResult,
}: {
  eventId: string
  roster: ReturnType<typeof useConsoleRoster>
  rows: readonly EventRegistrationDTO[]
  search: string
  onSearchChange: (value: string) => void
  canCheckIn: boolean
  format: ConsoleFormatters
  onResult: (result: CheckinResultDTO) => void
}) {
  const { t } = useT("host-checkin")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const rosterGate = useGate(roster)

  const checkInParty = useMutation({
    mutationFn: async (input: { seatIds: readonly string[]; registrationId: string }) => {
      const { done, last, firstError } = await checkInSeats(api, eventId, input.seatIds)
      if (last === null) throw firstError
      return { result: last, done, firstError, registrationId: input.registrationId }
    },
    onSuccess: ({ result, done, firstError, registrationId }) => {
      onResult(result)
      markRosterSeatsCheckedIn(qc, eventId, registrationId, done, new Date().toISOString())
      invalidateCheckinCounters(qc, eventId)
      if (firstError !== null) {
        toast.toast({ title: errors.message(firstError), tone: "danger" })
      }
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  return (
    <section
      aria-labelledby="checkin-roster"
      className="rounded-md border border-console-line bg-console-surface shadow-console-1"
    >
      <div className="flex flex-wrap items-center justify-between gap-token-3 border-b border-console-line px-token-4 py-token-3">
        <h2 id="checkin-roster" className="font-display text-token-16 font-bold text-console-ink">
          {t("roster.title")}
        </h2>
        <TextInput
          leadingIcon="search"
          type="search"
          className="w-56"
          aria-label={t("roster.search")}
          placeholder={t("roster.search")}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
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
                canCheckIn && seats.length > 0 ? (
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
  )
}

export function CheckinCharts({
  counters,
  format,
}: {
  counters: EventCheckinCountersDTO | undefined
  format: ConsoleFormatters
}) {
  const { t } = useT("host-checkin")
  const arrivals = (counters?.arrivals ?? []).map((bucket) => ({
    label: format.time(bucket.at),
    count: bucket.count,
  }))

  return (
    <section
      aria-labelledby="checkin-arrivals"
      className="grid gap-token-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
    >
      <div className={PANEL_CLASS}>
        <h2 id="checkin-arrivals" className={PANEL_HEADING_CLASS}>
          {t("arrivals.title")}
        </h2>
        {arrivals.length === 0 ? (
          <p className="text-token-13 text-console-ink-3">{t("arrivals.empty")}</p>
        ) : (
          <Histogram bins={arrivals} summary={t("arrivals.a11y")} valueLabel={t("arrivals.value")} />
        )}
        <p className="mt-token-2 text-token-12 text-console-ink-3">{t("arrivals.buckets")}</p>
      </div>
      <div className={PANEL_CLASS}>
        <h2 className={PANEL_HEADING_CLASS}>{t("by_type.title")}</h2>
        {(counters?.byTicketType.length ?? 0) === 0 ? (
          <p className="text-token-13 text-console-ink-3">{t("by_type.empty")}</p>
        ) : (
          <Donut
            summary={t("by_type.a11y")}
            size={140}
            centerValue={format.number(counters?.checkedIn ?? 0)}
            centerLabel={t("counters.checked_in")}
            segments={(counters?.byTicketType ?? []).map((row) => ({
              id: row.ticketTypeId,
              label: row.name,
              value: row.checkedIn,
            }))}
          />
        )}
      </div>
    </section>
  )
}

export function WalkupSheet({
  eventId,
  open,
  onClose,
  ticketTypes,
}: {
  eventId: string
  open: boolean
  onClose: () => void
  ticketTypes: readonly { id: string; name: string }[]
}) {
  const { t } = useT("host-checkin")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const [name, setName] = useState("")
  const [party, setParty] = useState(WALKUP_MIN_PARTY)
  const [ticketTypeId, setTicketTypeId] = useState("")

  const walkup = useMutation({
    mutationFn: () =>
      api.createWalkupRegistration({
        id: eventId,
        name: name.trim(),
        partySize: party,
        checkInNow: true,
        ...(ticketTypeId ? { ticketTypeId } : {}),
      }),
    onSuccess: (res) => {
      if (res.outcome === "registered" || res.outcome === "replayed") {
        toast.toast({ title: t("walkup.done", { name: name.trim() }), tone: "success" })
        onClose()
        setName("")
        setParty(WALKUP_MIN_PARTY)
        setTicketTypeId("")
        invalidateEvent(qc, eventId)
      } else {
        toast.toast({ title: t(`walkup.outcome_${res.outcome}`), tone: "danger" })
      }
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  return (
    <GuidedSheet
      open={open}
      onClose={onClose}
      title={t("walkup.title")}
      primaryLabel={t("walkup.submit")}
      primaryDisabled={name.trim().length === 0 || walkup.isPending}
      onPrimary={() => walkup.mutate()}
      notice={<p className="text-token-13 text-console-ink-3">{t("walkup.notice")}</p>}
    >
      <div className="flex flex-col gap-token-3">
        <Field label={t("walkup.name")}>
          {({ id }) => (
            <TextInput
              id={id}
              value={name}
              maxLength={MAX_ATTENDEE_NAME}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <Field label={t("walkup.party")}>
          {({ id }) => (
            <TextInput
              id={id}
              type="number"
              min={WALKUP_MIN_PARTY}
              max={MAX_PARTY_SIZE}
              value={party}
              onChange={(event) =>
                setParty(
                  Math.min(
                    MAX_PARTY_SIZE,
                    Math.max(WALKUP_MIN_PARTY, Number(event.target.value) || WALKUP_MIN_PARTY),
                  ),
                )
              }
            />
          )}
        </Field>
        {ticketTypes.length > 0 ? (
          <Field label={t("walkup.ticket_type")} optional>
            {({ id }) => (
              <Select
                id={id}
                value={ticketTypeId}
                placeholder={t("walkup.ticket_placeholder")}
                onChange={(event) => setTicketTypeId(event.target.value)}
                options={ticketTypes.map((type) => ({ value: type.id, label: type.name }))}
              />
            )}
          </Field>
        ) : null}
      </div>
    </GuidedSheet>
  )
}
