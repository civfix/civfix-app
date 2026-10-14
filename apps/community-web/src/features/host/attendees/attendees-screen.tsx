"use client"

import { useEffect, useMemo } from "react"
import { Megaphone } from "lucide-react"
import type {
  EventRegistrationDTO,
  RegistrationRosterFilter,
  RegistrationRosterSort,
} from "@civfix/shared"
import { useEventTicketTypes } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import {
  closeConsoleDrawer,
  useConsoleUrlState,
  type ConsoleParamPatch,
} from "@/components/console/url-state"
import { useGate } from "@/components/console/query-state"
import { ConsoleButton } from "@/components/console/button"
import { EmptyState, StateGate } from "@/components/console/states"
import { QRow } from "@/components/console/qrow"
import { DataTable, useSelection, FilterBar, SavedTabs } from "@/components/console/table"
import type { FilterFacet } from "@/components/console/table"

import { useConsoleEvent, useConsoleNavigation } from "../console-context"
import { EMPTY_VALUE, useConsoleFormat } from "../format"
import { ExportMenu } from "../exports/export-menu"
import { useConsoleRoster } from "./use-roster"
import { AttendeeDrawer } from "./attendee-drawer"
import { attendeeDisplayName } from "@civfix/shared/host"
import { AttendeeBulkActions } from "./attendee-bulk-actions"
import { AttendanceChip, attendeeColumns, rosterSortFor, rosterSortState } from "./attendee-columns"
import {
  ROSTER_FILTERS,
  isRosterFilter,
  isRosterSort,
  isWaitlistProjection,
  rosterEventTotal,
  rowSupportsRegistrationActions,
} from "./roster-filters"

export function AttendeesScreen() {
  const { t } = useT("host-attendees")
  const { t: tc } = useT("host-common")
  const { eventId, event, can } = useConsoleEvent()
  const format = useConsoleFormat(event.timezone ?? undefined)
  const { go } = useConsoleNavigation()
  const { params, set } = useConsoleUrlState()

  const filter: RegistrationRosterFilter = isRosterFilter(params.status) ? params.status : "all"
  const sort: RegistrationRosterSort = isRosterSort(params.sort)
    ? params.sort
    : "registered_at_desc"
  const search = params.q ?? ""
  const ticketTypeId = params.ticket ?? null
  const waitlistView = isWaitlistProjection(filter)

  const ticketTypes = useEventTicketTypes(eventId)
  const roster = useConsoleRoster({ eventId, filter, sort, q: search, ticketTypeId })
  const gate = useGate(roster)

  const rows = useMemo(
    () => (roster.data?.pages ?? []).flatMap((page) => page.items),
    [roster.data],
  )
  const eventTotal = rosterEventTotal(roster.data?.pages)

  const selectableIds = useMemo(
    () =>
      waitlistView
        ? []
        : rows.filter((row) => rowSupportsRegistrationActions(row, filter)).map((row) => row.id),
    [rows, filter, waitlistView],
  )
  const selection = useSelection(selectableIds)

  const setFilters = (patch: ConsoleParamPatch) => {
    selection.clear()
    set({ ...patch, cursor: null })
  }

  // The URL is the only source of the open attendee, so browser Back closes the drawer.
  const openRow = rows.find((row) => row.id === params.attendee) ?? null
  // A settled roster without the open row (a filter or a removal dropped it) would otherwise leave
  // ?attendee behind, and the drawer would pop back open when a later filter brings the row back.
  const attendeeGone =
    params.attendee != null && openRow === null && roster.isSuccess && !roster.isFetching
  useEffect(() => {
    if (attendeeGone) closeConsoleDrawer(["attendee"])
  }, [attendeeGone])

  const facets: FilterFacet[] = [
    ...(waitlistView
      ? []
      : [
          {
            id: "q",
            kind: "search" as const,
            label: t("filter.search"),
            value: search,
            placeholder: t("filter.search_placeholder"),
            onChange: (value: string) => setFilters({ q: value === "" ? null : value }),
          },
        ]),
    ...((ticketTypes.data?.length ?? 0) > 1
      ? [
          {
            id: "ticket",
            kind: "multi" as const,
            label: t("filter.ticket_type"),
            options: (ticketTypes.data ?? []).map((type) => ({
              value: type.id,
              label: type.name,
            })),
            values: ticketTypeId ? [ticketTypeId] : [],
            onChange: (values: string[]) => setFilters({ ticket: values[values.length - 1] ?? null }),
          },
        ]
      : []),
  ]

  const nameFallbacks = { guest: t("row.guest"), deleted: t("row.deleted_user") }
  const nameOf = (row: EventRegistrationDTO) => attendeeDisplayName(row, nameFallbacks)
  const columns = attendeeColumns({ t, format, waitlistView, nameOf })

  return (
    <div className="flex flex-col gap-token-4">
      <div className="flex flex-wrap items-center justify-between gap-token-3">
        <SavedTabs
          label={t("filter.tabs")}
          activeId={filter}
          onChange={(id) => setFilters({ status: id === "all" ? null : id })}
          tabs={ROSTER_FILTERS.map((id) => ({ id, label: t(`filter.${id}`) }))}
        />
        <div className="flex items-center gap-token-2">
          {can("broadcast") ? (
            <ConsoleButton
              variant="outline"
              size="sm"
              onClick={() => go({ kind: "broadcast-new", eventId })}
            >
              <Megaphone aria-hidden className="h-4 w-4" />
              {t("action.message")}
            </ConsoleButton>
          ) : null}
          {can("export") ? <ExportMenu eventId={eventId} eventTitle={event.title ?? ""} /> : null}
        </div>
      </div>

      <FilterBar
        facets={facets}
        onReset={() => setFilters({ q: null, ticket: null })}
      />

      <p className="text-token-12 text-console-ink-3">
        {t("summary.shown", { shown: format.number(rows.length) })}
        {eventTotal !== null
          ? ` · ${t("summary.event_total", { total: format.number(eventTotal) })}`
          : ""}
      </p>

      {waitlistView ? (
        <p
          role="status"
          className="rounded-sm border border-console-sky-strong/40 bg-console-sky-soft px-token-3 py-token-2 text-token-12 text-console-sky-strong"
        >
          {t("waitlist_notice")}
        </p>
      ) : null}

      <StateGate
        {...gate}
        onRetry={() => void roster.refetch()}
        empty={rows.length === 0}
        emptyState={
          <EmptyState
            variant={search !== "" || ticketTypeId !== null ? "filtered" : "none"}
            title={t("empty.title")}
            body={t("empty.body")}
            onClearFilters={() => setFilters({ q: null, ticket: null, status: null })}
          />
        }
      >
        <DataTable
          caption={t("table.caption")}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={roster.isPending}
          sort={rosterSortState(sort, waitlistView)}
          onSortChange={(next) => {
            const resolved = rosterSortFor(next)
            if (resolved) setFilters({ sort: resolved })
          }}
          selection={waitlistView ? undefined : selection}
          rowSelectLabel={(row) => t("table.select_row", { name: nameOf(row) })}
          onRowPress={waitlistView ? undefined : (row) => set({ attendee: row.id }, "push")}
          rowPressLabel={(row) => t("table.open_row", { name: nameOf(row) })}
          maxColumnPriority={2}
          renderCard={(row) => (
            <QRow
              as="card"
              title={nameOf(row)}
              sub={`${row.ticketTypeName ?? EMPTY_VALUE} · ${format.number(waitlistView ? row.partySize : row.seatCount)}`}
              chips={<AttendanceChip row={row} waitlistView={waitlistView} />}
              onPress={waitlistView ? undefined : () => set({ attendee: row.id }, "push")}
            />
          )}
          emptyState={<EmptyState title={t("empty.title")} body={t("empty.body")} />}
        />

        {roster.hasNextPage ? (
          <div className="mt-token-3 flex justify-center">
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

      <AttendeeBulkActions eventId={eventId} rows={rows} selection={selection} can={can} />

      <AttendeeDrawer
        key={openRow?.id ?? "none"}
        eventId={eventId}
        registration={openRow}
        ticketTypes={ticketTypes.data ?? []}
        canViewAnswers={can("view_answers")}
        canManage={can("manage_event")}
        canCheckIn={can("check_in")}
        canManageTickets={can("manage_tickets")}
        onClose={() => closeConsoleDrawer(["attendee"])}
      />
    </div>
  )
}
