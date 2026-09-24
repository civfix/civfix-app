"use client"

import type { QueryClient } from "@tanstack/react-query"
import type { EventRegistrationDTO, OrganizationDTO } from "@civfix/shared"

import { checkInSeatsInRow, rowStillPendingCheckIn } from "./attendees/roster-filters"
import { consoleKeys } from "./console-keys"

interface InfiniteRoster {
  pages: { items: EventRegistrationDTO[]; nextCursor: string | null; total?: number }[]
  pageParams: unknown[]
}

export function invalidateEvent(qc: QueryClient, eventId: string): void {
  void qc.invalidateQueries({ queryKey: ["host", eventId] })
  void qc.invalidateQueries({ queryKey: ["cleanup", eventId] })
}

export function invalidateCheckinCounters(qc: QueryClient, eventId: string): void {
  void qc.invalidateQueries({ queryKey: ["host", eventId, "counters"] })
  void qc.invalidateQueries({ queryKey: ["cleanup", eventId] })
}

/**
 * Two roster caches share the ["host", id, "roster"] prefix: the console's
 * ["host", id, "roster", "console", filter, sort, q, ticket] and the shared data layer's
 * ["host", id, "roster", filter, q]. The filter sits at a different index in each.
 */
function rosterFilterOf(queryKey: readonly unknown[]): unknown {
  return queryKey[3] === "console" ? queryKey[4] : queryKey[3]
}

export function markRosterSeatsCheckedIn(
  qc: QueryClient,
  eventId: string,
  registrationId: string,
  seatIds: readonly string[],
  at: string,
): void {
  if (seatIds.length === 0) return
  const queries = qc.getQueryCache().findAll({ queryKey: ["host", eventId, "roster"] })
  for (const query of queries) {
    const dropWhenSettled = rosterFilterOf(query.queryKey) === "not_checked_in"
    qc.setQueryData<InfiniteRoster>(query.queryKey, (previous) =>
      previous
        ? {
            ...previous,
            pages: previous.pages.map((page) => {
              const items: EventRegistrationDTO[] = []
              let removed = 0
              for (const item of page.items) {
                if (item.id !== registrationId) {
                  items.push(item)
                  continue
                }
                const next = checkInSeatsInRow(item, seatIds, at)
                if (dropWhenSettled && !rowStillPendingCheckIn(next)) {
                  removed += 1
                  continue
                }
                items.push(next)
              }
              return {
                ...page,
                items,
                ...(typeof page.total === "number" && removed > 0
                  ? { total: Math.max(0, page.total - removed) }
                  : {}),
              }
            }),
          }
        : previous,
    )
  }
}

export function invalidateOrg(qc: QueryClient, orgId: string): void {
  void qc.invalidateQueries({ queryKey: consoleKeys.org(orgId) })
  void qc.invalidateQueries({ queryKey: ["orgs", "mine"] })
}

/**
 * Seat a just-created or just-joined organization in the "my organizations" list BEFORE the
 * refetch lands: the org screen derives "not found" from that list, so navigating to the new org
 * on a stale list would flash the not-found state for the length of the round trip. A row already
 * there is merged (the server's fresh DTO wins) so an edit shows its new name at once too.
 */
export function upsertMyOrganization(qc: QueryClient, org: OrganizationDTO): void {
  qc.setQueryData<OrganizationDTO[]>(["orgs", "mine"], (previous) => {
    const rows = previous ?? []
    if (!rows.some((row) => row.id === org.id)) return [...rows, org]
    return rows.map((row) => (row.id === org.id ? { ...row, ...org } : row))
  })
}
