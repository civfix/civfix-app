"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, Megaphone, Trash2, UserCheck, UserX } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  EventRegistrationDTO,
  RegistrationRosterFilter,
  RegistrationRosterSort,
} from "@civfix/shared"
import { useApi, useEventTicketTypes } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { closeConsoleDrawer, useConsoleUrlState } from "@/components/console/url-state"
import { useGate } from "@/components/console/query-state"
import { ConsoleButton } from "@/components/console/button"
import { EmptyState, StateGate } from "@/components/console/states"
import { Chip } from "@/components/console/chips/chip"
import { QRow } from "@/components/console/qrow"
import { DataTable, useSelection, BulkBar, FilterBar, SavedTabs } from "@/components/console/table"
import type { DataTableColumn, FilterFacet, SortState } from "@/components/console/table"
import { useConsoleToast } from "@/components/console/overlay/toast"
import { ConfirmModal } from "@/components/console/overlay/confirm-modal"

import { useConsoleEvent, useConsoleNavigation } from "../console-context"
import { useConsoleErrors } from "../error-copy"
import { useConsoleFormat } from "../format"
import { ExportMenu } from "../exports/export-menu"
import { useConsoleRoster } from "./use-roster"
import { AttendeeDrawer } from "./attendee-drawer"
import { invalidateEvent } from "../console-invalidate"
import {
  ROSTER_FILTERS,
  attendanceOf,
  attendeeDisplayName,
  checkableSeatIds,
  isRosterFilter,
  isRosterSort,
  isWaitlistProjection,
  rosterTotals,
  rowSupportsRegistrationActions,
} from "./roster-filters"

const SORT_COLUMN: Record<string, RegistrationRosterSort> = {
  name: "name_asc",
  registeredAt: "registered_at_desc",
  checkedInAt: "checked_in_at_desc",
}

export function AttendeesScreen() {
  const { t } = useT("host-attendees")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const format = useConsoleFormat()
  const { eventId, event, can } = useConsoleEvent()
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
  const totals = rosterTotals(
    rows.length,
    roster.data?.pages[0]?.total,
    roster.hasNextPage === true,
  )

  const selectableIds = useMemo(
    () =>
      waitlistView
        ? []
        : rows.filter((row) => rowSupportsRegistrationActions(row, filter)).map((row) => row.id),
    [rows, filter, waitlistView],
  )
  const selection = useSelection(selectableIds)

  useEffect(() => {
    selection.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sort, search, ticketTypeId])

  const [openId, setOpenId] = useState<string | null>(null)
  const [confirmNoShow, setConfirmNoShow] = useState(false)
  const openRow = rows.find((row) => row.id === (params.attendee ?? openId)) ?? null

  const refresh = () => invalidateEvent(qc, eventId)

  const bulkCheckIn = useMutation({
    mutationFn: async (ids: readonly string[]) => {
      const targets = rows.filter((row) => ids.includes(row.id))
      let done = 0
      let failed = 0
      for (const row of targets) {
        for (const seatId of checkableSeatIds(row)) {
          try {
            await api.checkInEventSeat({ id: eventId, seatId, method: "manual" })
            done += 1
          } catch {
            failed += 1
          }
        }
      }
      return { done, failed }
    },
    onSuccess: ({ done, failed }) => {
      toast.toast({
        title: t("bulk.checked_in", { count: done }),
        ...(failed > 0 ? { description: t("bulk.partial", { count: failed }) } : {}),
        tone: failed > 0 ? "danger" : "success",
      })
      selection.clear()
      refresh()
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  const bulkNoShow = useMutation({
    mutationFn: (ids: readonly string[]) => {
      const seatIds = rows
        .filter((row) => ids.includes(row.id))
        .flatMap((row) => row.seats.filter((seat) => seat.status === "active").map((s) => s.id))
      return api.markEventNoShows({ id: eventId, seatIds, all: false })
    },
    onSuccess: (res) => {
      toast.toast({ title: t("bulk.no_show", { count: res.marked }), tone: "success" })
      selection.clear()
      setConfirmNoShow(false)
      refresh()
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  const bulkRemove = useMutation({
    mutationFn: async (input: { ids: readonly string[]; reason?: string }) => {
      let done = 0
      let failed = 0
      for (const id of input.ids) {
        try {
          await api.removeEventRegistration({
            id: eventId,
            registrationId: id,
            ban: false,
            ...(input.reason ? { reason: input.reason } : {}),
          })
          done += 1
        } catch {
          failed += 1
        }
      }
      return { done, failed }
    },
    onSuccess: ({ done, failed }) => {
      toast.toast({
        title: t("bulk.removed", { count: done }),
        ...(failed > 0 ? { description: t("bulk.partial", { count: failed }) } : {}),
        tone: failed > 0 ? "danger" : "success",
      })
      selection.clear()
      refresh()
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

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
            onChange: (value: string) => set({ q: value === "" ? null : value, cursor: null }),
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
            onChange: (values: string[]) =>
              set({ ticket: values[values.length - 1] ?? null, cursor: null }),
          },
        ]
      : []),
  ]

  const columns: DataTableColumn<EventRegistrationDTO>[] = [
    {
      id: "name",
      label: t("column.name"),
      sortable: !waitlistView,
      render: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-console-ink">
            {attendeeDisplayName(row, { guest: t("row.guest"), deleted: t("row.deleted_user") })}
          </span>
          {row.answersPreview ? (
            <span className="truncate text-token-12 text-console-ink-3">{row.answersPreview}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: "kind",
      label: t("column.kind"),
      columnPriority: 2,
      render: (row) => <Chip kind="attendee-kind" value={row.kind} size="sm" />,
    },
    {
      id: "ticketType",
      label: t("column.ticket_type"),
      columnPriority: 1,
      render: (row) => row.ticketTypeName ?? "—",
    },
    {
      id: "seats",
      label: waitlistView ? t("column.party") : t("column.seats"),
      align: "right",
      render: (row) => format.number(waitlistView ? row.partySize : row.seatCount),
    },
    {
      id: "attendance",
      label: t("column.attendance"),
      render: (row) =>
        waitlistView ? (
          <Chip kind="waitlist-status" value="waiting" size="sm" />
        ) : (
          <Chip kind="attendance" value={attendanceOf(row)} size="sm" />
        ),
    },
    {
      id: "registeredAt",
      label: t("column.registered_at"),
      sortable: !waitlistView,
      columnPriority: 1,
      render: (row) => format.dateTime(row.registeredAt),
    },
    {
      id: "checkedInAt",
      label: t("column.checked_in_at"),
      sortable: !waitlistView,
      columnPriority: 2,
      render: (row) => (row.checkedInAt ? format.time(row.checkedInAt) : "—"),
    },
  ]

  const sortState: SortState | null = waitlistView
    ? null
    : sort === "name_asc"
      ? { columnId: "name", dir: "asc" }
      : sort === "checked_in_at_desc"
        ? { columnId: "checkedInAt", dir: "desc" }
        : { columnId: "registeredAt", dir: sort === "registered_at_asc" ? "asc" : "desc" }

  return (
    <div className="flex flex-col gap-token-4">
      <div className="flex flex-wrap items-center justify-between gap-token-3">
        <SavedTabs
          label={t("filter.tabs")}
          activeId={filter}
          onChange={(id) => set({ status: id === "all" ? null : id, cursor: null })}
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
          {can("export") ? <ExportMenu eventId={eventId} eventTitle={event?.title ?? ""} /> : null}
        </div>
      </div>

      <FilterBar
        facets={facets}
        onReset={() => set({ q: null, ticket: null, cursor: null })}
      />

      <p className="text-token-12 text-console-ink-3">
        {t("summary.shown", { shown: format.number(totals.shown) })}
        {totals.eventTotal !== null
          ? ` · ${t("summary.event_total", { total: format.number(totals.eventTotal) })}`
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
            onClearFilters={() => set({ q: null, ticket: null, status: null, cursor: null })}
          />
        }
      >
        <DataTable
          caption={t("table.caption")}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={roster.isPending}
          sort={sortState}
          onSortChange={(next) => {
            const base = SORT_COLUMN[next.columnId]
            if (!base) return
            const resolved: RegistrationRosterSort =
              base === "registered_at_desc" && next.dir === "asc" ? "registered_at_asc" : base
            set({ sort: resolved, cursor: null })
          }}
          selection={waitlistView ? undefined : selection}
          rowSelectLabel={(row) =>
            t("table.select_row", {
              name: attendeeDisplayName(row, {
                guest: t("row.guest"),
                deleted: t("row.deleted_user"),
              }),
            })
          }
          onRowPress={waitlistView ? undefined : (row) => {
            setOpenId(row.id)
            set({ attendee: row.id }, "push")
          }}
          rowPressLabel={(row) =>
            t("table.open_row", {
              name: attendeeDisplayName(row, {
                guest: t("row.guest"),
                deleted: t("row.deleted_user"),
              }),
            })
          }
          maxColumnPriority={2}
          renderCard={(row) => (
            <QRow
              as="card"
              title={attendeeDisplayName(row, {
                guest: t("row.guest"),
                deleted: t("row.deleted_user"),
              })}
              sub={`${row.ticketTypeName ?? "—"} · ${format.number(waitlistView ? row.partySize : row.seatCount)}`}
              chips={
                waitlistView ? (
                  <Chip kind="waitlist-status" value="waiting" size="sm" />
                ) : (
                  <Chip kind="attendance" value={attendanceOf(row)} size="sm" />
                )
              }
              onPress={
                waitlistView
                  ? undefined
                  : () => {
                      setOpenId(row.id)
                      set({ attendee: row.id }, "push")
                    }
              }
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

      <BulkBar
        count={selection.count}
        onClear={() => selection.clear()}
        actions={[
          ...(can("check_in")
            ? [
                {
                  id: "check-in",
                  label: t("bulk.check_in"),
                  icon: UserCheck,
                  disabled: bulkCheckIn.isPending,
                  onPress: () => bulkCheckIn.mutate([...selection.selectedIds]),
                },
                {
                  id: "no-show",
                  label: t("bulk.mark_no_show"),
                  icon: UserX,
                  disabled: bulkNoShow.isPending,
                  onPress: () => setConfirmNoShow(true),
                },
              ]
            : []),
          ...(can("manage_event")
            ? [
                {
                  id: "remove",
                  label: t("bulk.remove"),
                  icon: Trash2,
                  destructive: true,
                  disabled: bulkRemove.isPending,
                  onPress: () => bulkRemove.mutate({ ids: [...selection.selectedIds] }),
                },
              ]
            : []),
          ...(can("export")
            ? [
                {
                  id: "export",
                  label: t("bulk.export_hint"),
                  icon: Download,
                  disabled: true,
                  disabledReason: t("bulk.export_reason"),
                  onPress: () => undefined,
                },
              ]
            : []),
        ]}
      />

      <ConfirmModal
        open={confirmNoShow}
        severity="warn"
        title={t("no_show.title")}
        body={t("no_show.body", { count: selection.count })}
        confirmLabel={t("no_show.confirm")}
        busy={bulkNoShow.isPending}
        onCancel={() => setConfirmNoShow(false)}
        onConfirm={() => bulkNoShow.mutate([...selection.selectedIds])}
      />

      <AttendeeDrawer
        key={openRow?.id ?? "none"}
        eventId={eventId}
        registration={openRow}
        ticketTypes={ticketTypes.data ?? []}
        canViewAnswers={can("view_answers")}
        canManage={can("manage_event")}
        canCheckIn={can("check_in")}
        canManageTickets={can("manage_tickets")}
        onClose={() => {
          setOpenId(null)
          closeConsoleDrawer(["attendee"])
        }}
      />
    </div>
  )
}
