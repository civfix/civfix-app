"use client"

import type { QueryClient } from "@tanstack/react-query"
import type { EventRegistrationDTO, OrganizationDTO } from "@civfix/shared"
import { queryKeys } from "@civfix/ui/data"

import { checkInSeatsInRow, rowStillPendingCheckIn } from "./attendees/roster-filters"
import { consoleKeys } from "./console-keys"

interface InfiniteRoster {
  pages: { items: EventRegistrationDTO[]; nextCursor: string | null; total?: number }[]
  pageParams: unknown[]
}

export function invalidateEvent(qc: QueryClient, eventId: string): void {
  void qc.invalidateQueries({ queryKey: queryKeys.hostEvent(eventId) })
  void qc.invalidateQueries({ queryKey: queryKeys.cleanup(eventId) })
}

/**
 * The host caches that read registrations, seats or check-ins: the rosters, counters, insights,
 * analytics, ticket-type sold counts, and the live recipient counts of broadcast and announcement
 * audiences. The rest of ["host", id] (page, slug check, questions, team, exports, a registration's
 * answers) is configuration or registrant input that a roster change cannot alter.
 */
const ROSTER_DEPENDENT_SEGMENTS: ReadonlySet<string> = new Set([
  "roster",
  "counters",
  "insights",
  "analytics",
  "ticket-types",
  "audience-preview",
  "broadcasts",
  "announcements",
])

/** After a check-in, no-show, note, removal or walk-up; a move or an event edit uses `invalidateEvent`. */
export function invalidateRoster(qc: QueryClient, eventId: string): void {
  void qc.invalidateQueries({
    queryKey: queryKeys.hostEvent(eventId),
    predicate: (query) => ROSTER_DEPENDENT_SEGMENTS.has(String(query.queryKey[2])),
  })
  void qc.invalidateQueries({ queryKey: queryKeys.cleanup(eventId) })
}

export function invalidateCheckinCounters(qc: QueryClient, eventId: string): void {
  void qc.invalidateQueries({ queryKey: queryKeys.hostCounters(eventId) })
  void qc.invalidateQueries({ queryKey: queryKeys.cleanup(eventId) })
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
  const queries = qc.getQueryCache().findAll({ queryKey: consoleKeys.rosterRoot(eventId) })
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
  void qc.invalidateQueries({ queryKey: queryKeys.myOrganizations })
}

/**
 * Seat a just-created or just-joined organization in the "my organizations" list BEFORE the
 * refetch lands: the org screen derives "not found" from that list, so navigating to the new org
 * on a stale list would flash the not-found state for the length of the round trip. A row already
 * there is merged (the server's fresh DTO wins) so an edit shows its new name at once too.
 */
export function upsertMyOrganization(qc: QueryClient, org: OrganizationDTO): void {
  qc.setQueryData<OrganizationDTO[]>(queryKeys.myOrganizations, (previous) => {
    const rows = previous ?? []
    if (!rows.some((row) => row.id === org.id)) return [...rows, org]
    return rows.map((row) => (row.id === org.id ? { ...row, ...org } : row))
  })
}
