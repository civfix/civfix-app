export type SearchGroupId = "people" | "events" | "reports"

export const SEARCH_EVENT_POOL_LIMIT = 10

export const SEARCH_RESULT_CARD_LAYOUT = {
  gap: 9,
  radius: 18,
} as const

export function groupSearchResults({
  people,
  events,
  reports,
}: {
  people: readonly { id: string }[]
  events: readonly { id: string }[]
  reports: readonly { id: string }[]
}): Array<{ id: SearchGroupId; count: number }> {
  return [
    { id: "events" as const, count: events.length },
    { id: "reports" as const, count: reports.length },
    { id: "people" as const, count: people.length },
  ].filter((group) => group.count > 0)
}

export type SearchResultRow<E, R, P> =
  | { kind: "header"; key: string; group: SearchGroupId }
  | { kind: "event"; key: string; event: E; gapBefore: boolean }
  | { kind: "report"; key: string; report: R; gapBefore: boolean }
  | { kind: "more-reports"; key: string; loading: boolean }
  | { kind: "person"; key: string; person: P; gapBefore: boolean }

/** Keys carry the kind because an event, a report and a person can share an id once they sit in one list. */
export function searchResultRows<E extends { id: string }, R extends { id: string }, P extends { id: string }>(
  hits: { events: readonly E[]; reports: readonly R[]; people: readonly P[] },
  moreReports: { show: boolean; loading: boolean },
): SearchResultRow<E, R, P>[] {
  const rows: SearchResultRow<E, R, P>[] = []
  if (hits.events.length > 0) {
    rows.push({ kind: "header", key: "header:events", group: "events" })
    hits.events.forEach((event, index) =>
      rows.push({ kind: "event", key: `event:${event.id}`, event, gapBefore: index > 0 }),
    )
  }
  if (hits.reports.length > 0) {
    rows.push({ kind: "header", key: "header:reports", group: "reports" })
    hits.reports.forEach((report, index) =>
      rows.push({ kind: "report", key: `report:${report.id}`, report, gapBefore: index > 0 }),
    )
    if (moreReports.show) rows.push({ kind: "more-reports", key: "more:reports", loading: moreReports.loading })
  }
  if (hits.people.length > 0) {
    rows.push({ kind: "header", key: "header:people", group: "people" })
    hits.people.forEach((person, index) =>
      rows.push({ kind: "person", key: `person:${person.id}`, person, gapBefore: index > 0 }),
    )
  }
  return rows
}

export function filterEventHits<T extends { title: string; address?: string | null }>(
  events: readonly T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return []
  return events.filter(
    (event) =>
      event.title.toLowerCase().includes(needle) ||
      (event.address ?? "").toLowerCase().includes(needle),
  )
}

export type SearchResultsPhase = "loading" | "results" | "empty" | "error"

export interface SearchSourceState {
  enabled: boolean
  matchesQuery: boolean
  fetching: boolean
  errored: boolean
}

export interface SearchResultsView {
  phase: SearchResultsPhase
  settled: boolean
  showErrorNotice: boolean
}

export function isSearchSourceSettled(source: SearchSourceState): boolean {
  if (!source.enabled) return true
  if (!source.matchesQuery) return false
  return source.errored || !source.fetching
}

export function searchSourcesSettled(sources: readonly SearchSourceState[]): boolean {
  return sources.every(isSearchSourceSettled)
}

export function searchResultsView(
  sources: readonly SearchSourceState[],
  hitCount: number,
): SearchResultsView {
  const active = sources.filter((source) => source.enabled)
  const settled = active.every(isSearchSourceSettled)
  const errored = active.some((source) => source.errored)
  const allErrored = active.length > 0 && active.every((source) => source.errored)
  if (hitCount > 0) return { phase: "results", settled, showErrorNotice: settled && errored }
  if (!settled) return { phase: "loading", settled, showErrorNotice: false }
  if (allErrored) return { phase: "error", settled, showErrorNotice: false }
  return { phase: "empty", settled, showErrorNotice: errored }
}

export interface SearchHitsSelection<T> {
  hits: T
  record: boolean
}

export function selectSearchHits<T>(
  live: T,
  held: T,
  liveCount: number,
  settled: boolean,
): SearchHitsSelection<T> {
  const paint = settled || liveCount > 0
  return { hits: paint ? live : held, record: paint }
}

export interface SearchAnnouncement {
  kind: "results" | "empty"
  key: string
}

export function searchAnnouncement(
  view: SearchResultsView,
  query: string,
  hitCount: number,
): SearchAnnouncement | null {
  if (!view.settled) return null
  if (view.phase === "results") return { kind: "results", key: `results:${query}:${hitCount}` }
  if (view.phase === "empty") return { kind: "empty", key: `empty:${query}` }
  return null
}
