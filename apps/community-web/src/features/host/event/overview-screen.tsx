"use client"

import { ExternalLink, Ticket, Users } from "lucide-react"
import { useHostCounters, useEventTicketTypes } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { hrefForRoute } from "@/components/console/route"
import { useGate } from "@/components/console/query-state"
import { LoadingState, StateGate } from "@/components/console/states"
import { Chip } from "@/components/console/chips/chip"
import { Donut, KpiCell, StatStrip } from "@/components/console/charts"

import { ConsoleLink } from "../layout/console-link"
import { useConsoleEvent } from "../console-context"
import { useConsoleFormat } from "../format"

function ArrivalsSummary({ eventId, timeZone }: { eventId: string; timeZone?: string }) {
  const { t } = useT("host-event")
  const format = useConsoleFormat(timeZone)
  const counters = useHostCounters(eventId)
  const gate = useGate(counters)
  const data = counters.data

  return (
    <StateGate
      {...gate}
      onRetry={() => void counters.refetch()}
      skeleton={<LoadingState shape="kpi" count={1} />}
    >
      {data ? (
        <>
          <StatStrip className="w-full">
            <KpiCell
              size="strip"
              label={t("counters.registered")}
              value={format.number(data.registered)}
            />
            <KpiCell
              size="strip"
              label={t("counters.checked_in")}
              value={format.number(data.checkedIn)}
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
            <KpiCell
              size="strip"
              label={t("counters.capacity")}
              value={data.capacity === null ? t("counters.unlimited") : format.number(data.capacity)}
            />
          </StatStrip>
          <p className="mt-token-2 text-token-12 text-console-ink-3">
            {t("counters.as_of", { time: format.time(data.asOf) })} · {t("counters.units")}
          </p>
        </>
      ) : null}
    </StateGate>
  )
}

export function OverviewScreen() {
  const { t } = useT("host-event")
  const { eventId, event, can } = useConsoleEvent()
  const eventTimeZone = event?.timezone ?? undefined
  const format = useConsoleFormat(eventTimeZone)
  const zoneShort = event?.scheduledAt ? format.zoneLabel(event.scheduledAt) : null
  const ticketTypes = useEventTicketTypes(eventId)
  const ticketsGate = useGate(ticketTypes)
  const types = ticketTypes.data ?? []

  return (
    <div className="flex flex-col gap-token-6">
      <section aria-labelledby="overview-counters">
        <h2 id="overview-counters" className="sr-only">
          {t("counters.heading")}
        </h2>
        <ArrivalsSummary eventId={eventId} {...(eventTimeZone ? { timeZone: eventTimeZone } : {})} />
      </section>

      <section
        aria-labelledby="overview-details"
        className="grid gap-token-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      >
        <div className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1">
          <h2
            id="overview-details"
            className="mb-token-3 font-display text-token-16 font-bold text-console-ink"
          >
            {t("details.title")}
          </h2>
          <dl className="flex flex-col gap-token-3">
            <div className="flex flex-wrap items-baseline justify-between gap-token-2">
              <dt className="text-token-13 text-console-ink-3">{t("details.when")}</dt>
              <dd className="text-token-14 font-semibold text-console-ink">
                {format.dateTime(event?.scheduledAt ?? new Date().toISOString())}
                {event?.endsAt ? ` – ${format.time(event.endsAt)}` : ""}
                {zoneShort ? ` ${zoneShort}` : ""}
              </dd>
            </div>
            {event?.timezone && zoneShort ? (
              <div className="flex flex-wrap items-baseline justify-between gap-token-2">
                <dt className="text-token-13 text-console-ink-3">{t("details.timezone")}</dt>
                <dd className="text-token-14 text-console-ink-2">
                  {`${zoneShort} (${event.timezone})`}
                </dd>
              </div>
            ) : null}
            <div className="flex flex-wrap items-baseline justify-between gap-token-2">
              <dt className="text-token-13 text-console-ink-3">{t("details.where")}</dt>
              <dd className="max-w-[60%] text-right text-token-14 text-console-ink-2">
                {event?.address ?? t("details.no_address")}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-token-2">
              <dt className="text-token-13 text-console-ink-3">{t("details.registration")}</dt>
              <dd className="text-token-14 text-console-ink-2">
                {event?.registrationOpensAt
                  ? format.dateTime(event.registrationOpensAt)
                  : t("details.registration_open")}
                {event?.registrationClosesAt
                  ? ` → ${format.dateTime(event.registrationClosesAt)}`
                  : ""}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-token-2">
              <dt className="text-token-13 text-console-ink-3">{t("details.team")}</dt>
              <dd className="text-token-14 text-console-ink-2">
                {format.number(event?.teamCount ?? 0)}
              </dd>
            </div>
            {event?.organization ? (
              <div className="flex flex-wrap items-baseline justify-between gap-token-2">
                <dt className="text-token-13 text-console-ink-3">{t("details.organization")}</dt>
                <dd className="text-token-14 text-console-ink-2">{event.organization.name}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="flex flex-col gap-token-4">
          <div className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1">
            <h2 className="mb-token-3 font-display text-token-16 font-bold text-console-ink">
              {t("page.title")}
            </h2>
            <div className="flex flex-wrap items-center gap-token-3">
              {event?.pageStatus ? (
                <Chip kind="page-state" value={event.pageStatus} />
              ) : (
                <span className="text-token-13 text-console-ink-3">{t("page.none")}</span>
              )}
              {event?.pageSlug ? (
                <a
                  href={`/e/${event.pageSlug}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-xs text-token-13 font-semibold text-console-sky-strong underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-console-ring"
                >
                  {`/e/${event.pageSlug}`}
                  <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                </a>
              ) : null}
              {can("manage_page") ? (
                <ConsoleLink
                  href={hrefForRoute({ kind: "event", eventId, section: "page" })}
                  className="rounded-xs text-token-13 font-semibold text-console-ink-2 underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-console-ring"
                >
                  {t("page.edit")}
                </ConsoleLink>
              ) : null}
            </div>
          </div>

          <div className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1">
            <h2 className="mb-token-3 font-display text-token-16 font-bold text-console-ink">
              {t("tickets.title")}
            </h2>
            <StateGate
              {...ticketsGate}
              onRetry={() => void ticketTypes.refetch()}
              skeleton={<LoadingState count={2} />}
              empty={types.length === 0}
              emptyState={
                <p className="text-token-13 text-console-ink-3">{t("tickets.none")}</p>
              }
            >
              <Donut
                summary={t("tickets.a11y")}
                centerValue={format.number(types.reduce((sum, type) => sum + type.sold, 0))}
                centerLabel={t("tickets.sold")}
                segments={types.map((type) => ({
                  id: type.id,
                  label: type.name,
                  value: type.sold,
                }))}
              />
            </StateGate>
          </div>
        </div>
      </section>

      <section aria-labelledby="overview-quick" className="flex flex-wrap gap-token-3">
        <h2 id="overview-quick" className="sr-only">
          {t("quick.heading")}
        </h2>
        {can("view_roster") ? (
          <ConsoleLink
            href={hrefForRoute({ kind: "event", eventId, section: "attendees" })}
            className="inline-flex min-h-11 items-center gap-token-2 rounded-sm border border-console-line bg-console-surface px-token-4 text-token-14 font-semibold text-console-ink shadow-console-1 transition-colors duration-d1 hover:bg-console-surface-alt focus-visible:outline-none focus-visible:shadow-console-ring"
          >
            <Users aria-hidden className="h-4 w-4" />
            {t("quick.attendees")}
          </ConsoleLink>
        ) : null}
        {can("manage_tickets") ? (
          <ConsoleLink
            href={hrefForRoute({ kind: "event", eventId, section: "tickets" })}
            className="inline-flex min-h-11 items-center gap-token-2 rounded-sm border border-console-line bg-console-surface px-token-4 text-token-14 font-semibold text-console-ink shadow-console-1 transition-colors duration-d1 hover:bg-console-surface-alt focus-visible:outline-none focus-visible:shadow-console-ring"
          >
            <Ticket aria-hidden className="h-4 w-4" />
            {t("quick.tickets")}
          </ConsoleLink>
        ) : null}
        <a
          href={`/cleanups/${eventId}/`}
          className="inline-flex min-h-11 items-center gap-token-2 rounded-sm border border-console-line bg-console-surface px-token-4 text-token-14 font-semibold text-console-ink shadow-console-1 transition-colors duration-d1 hover:bg-console-surface-alt focus-visible:outline-none focus-visible:shadow-console-ring"
        >
          <ExternalLink aria-hidden className="h-4 w-4" />
          {t("quick.public_view")}
        </a>
      </section>
    </div>
  )
}
