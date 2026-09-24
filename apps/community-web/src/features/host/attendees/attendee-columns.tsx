"use client"

import type { EventRegistrationDTO, RegistrationRosterSort } from "@civfix/shared"
import type { useT } from "@civfix/ui/i18n"

import { Chip } from "@/components/console/chips/chip"
import type { DataTableColumn, SortState } from "@/components/console/table"

import type { ConsoleFormatters } from "../format"
import { EmptyValue } from "../analytics/analytics-value"
import { attendanceOf } from "./roster-filters"

type Translate = ReturnType<typeof useT>["t"]

const SORT_COLUMN: Record<string, RegistrationRosterSort> = {
  name: "name_asc",
  registeredAt: "registered_at_desc",
  checkedInAt: "checked_in_at_desc",
}

export function rosterSortState(
  sort: RegistrationRosterSort,
  waitlistView: boolean,
): SortState | null {
  if (waitlistView) return null
  if (sort === "name_asc") return { columnId: "name", dir: "asc" }
  if (sort === "checked_in_at_desc") return { columnId: "checkedInAt", dir: "desc" }
  return { columnId: "registeredAt", dir: sort === "registered_at_asc" ? "asc" : "desc" }
}

export function rosterSortFor(next: SortState): RegistrationRosterSort | null {
  const base = SORT_COLUMN[next.columnId]
  if (!base) return null
  return base === "registered_at_desc" && next.dir === "asc" ? "registered_at_asc" : base
}

export function AttendanceChip({
  row,
  waitlistView,
}: {
  row: EventRegistrationDTO
  waitlistView: boolean
}) {
  return waitlistView ? (
    <Chip kind="waitlist-status" value="waiting" size="sm" />
  ) : (
    <Chip kind="attendance" value={attendanceOf(row)} size="sm" />
  )
}

export function attendeeColumns({
  t,
  format,
  waitlistView,
  nameOf,
}: {
  t: Translate
  format: ConsoleFormatters
  waitlistView: boolean
  nameOf: (row: EventRegistrationDTO) => string
}): DataTableColumn<EventRegistrationDTO>[] {
  return [
    {
      id: "name",
      label: t("column.name"),
      sortable: !waitlistView,
      render: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-console-ink">{nameOf(row)}</span>
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
      render: (row) => row.ticketTypeName ?? <EmptyValue />,
    },
    {
      id: "seats",
      label: waitlistView ? t("drawer.party") : t("column.seats"),
      align: "right",
      render: (row) => format.number(waitlistView ? row.partySize : row.seatCount),
    },
    {
      id: "attendance",
      label: t("column.attendance"),
      render: (row) => <AttendanceChip row={row} waitlistView={waitlistView} />,
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
      render: (row) => (row.checkedInAt ? format.time(row.checkedInAt) : <EmptyValue />),
    },
  ]
}
