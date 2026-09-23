import {
  MAX_LINKED_REPORTS,
  haversineMeters,
  type BBox,
  type LinkedReportRef,
  type ReportCategory,
  type ReportPinDTO,
} from "@civfix/shared"
import type { LatLng } from "@civfix/shared/geocode"
import { PIN_SPAN_MAX_DEG, clampLat, clampLng } from "../../data/hooks/nearbyBbox"
import type { LinkedReportCardEntry } from "../linkedReportCards"

export const PICKER_ZOOM = 14
export const PICKER_RADIUS_M = 500
export const PICKER_FETCH_PAD = 0.5
export const PICKER_FETCH_PRECISION = 3
export const PICKER_MAX_FETCH_SPAN_DEG = PIN_SPAN_MAX_DEG
export const PICKER_MAX_PINS = 400
export const PICKER_SEARCH_MIN_CHARS = 3
export const PICKER_PAGE_FIRST = 8
export const PICKER_PAGE_STEP = 3

export type PickerPinState = "idle" | "selected" | "linked" | "unlinking"

export function pinState(
  id: string,
  ids: ReadonlySet<string>,
  linked: ReadonlySet<string>,
): PickerPinState {
  const chosen = ids.has(id)
  const wasLinked = linked.has(id)
  if (chosen) return wasLinked ? "linked" : "selected"
  return wasLinked ? "unlinking" : "idle"
}

export type PinBadgeKind = "check" | "plus" | null

export interface PinPresentation {
  active: boolean
  badge: PinBadgeKind
  muted: boolean
}

export function pinPresentation(state: PickerPinState, focused: boolean): PinPresentation {
  switch (state) {
    case "selected":
      return { active: true, badge: "check", muted: false }
    case "linked":
      return { active: focused, badge: "check", muted: !focused }
    case "unlinking":
      return { active: focused, badge: null, muted: false }
    default:
      return { active: focused, badge: null, muted: false }
  }
}

export function isChosen(state: PickerPinState): boolean {
  return state === "selected" || state === "linked"
}

function roundCoord(n: number): number {
  const factor = 10 ** PICKER_FETCH_PRECISION
  return Math.round(n * factor) / factor
}

export function bboxSpan(bbox: BBox): number {
  return Math.max(bbox.east - bbox.west, bbox.north - bbox.south)
}

export function bboxContains(outer: BBox, inner: BBox): boolean {
  return (
    inner.west >= outer.west &&
    inner.east <= outer.east &&
    inner.south >= outer.south &&
    inner.north <= outer.north
  )
}

export function bboxHolds(bbox: BBox, point: LatLng): boolean {
  return (
    point.lng >= bbox.west &&
    point.lng <= bbox.east &&
    point.lat >= bbox.south &&
    point.lat <= bbox.north
  )
}

export function pickerFetchRegion(viewport: BBox): BBox | null {
  const width = viewport.east - viewport.west
  const height = viewport.north - viewport.south
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  if (Math.max(width, height) > PICKER_MAX_FETCH_SPAN_DEG) return null
  const padLng = width * PICKER_FETCH_PAD
  const padLat = height * PICKER_FETCH_PAD
  return {
    west: clampLng(roundCoord(viewport.west - padLng)),
    east: clampLng(roundCoord(viewport.east + padLng)),
    south: clampLat(roundCoord(viewport.south - padLat)),
    north: clampLat(roundCoord(viewport.north + padLat)),
  }
}

export function shouldRefetch(viewport: BBox, loaded: BBox | null): boolean {
  if (!loaded) return true
  return !bboxContains(loaded, viewport)
}

export function refToPin(ref: LinkedReportRef): ReportPinDTO {
  return {
    id: ref.id,
    category: ref.category,
    status: ref.status,
    lat: ref.lat,
    lng: ref.lng,
    title: ref.title,
    ...(ref.type !== undefined ? { type: ref.type } : {}),
    ...(ref.addr !== undefined ? { addr: ref.addr } : {}),
    ...(ref.thumbUrl !== undefined ? { thumbUrl: ref.thumbUrl } : {}),
  }
}

export function cardToPin(card: LinkedReportCardEntry): ReportPinDTO {
  return {
    id: card.id,
    category: card.category,
    status: card.status ?? "published",
    lat: card.lat,
    lng: card.lng,
    ...(card.type != null ? { type: card.type } : {}),
    ...(card.title !== undefined ? { title: card.title } : {}),
    ...(card.description !== undefined ? { description: card.description } : {}),
    ...(card.thumbUrl !== undefined ? { thumbUrl: card.thumbUrl } : {}),
    ...(card.addr !== undefined ? { addr: card.addr } : {}),
    ...(card.referenceCode != null ? { referenceCode: card.referenceCode } : {}),
  }
}

export function refFromCard(card: LinkedReportCardEntry, linkedAt: string): LinkedReportRef {
  return {
    id: card.id,
    category: card.category,
    status: card.status ?? "published",
    title: card.title?.trim() || "",
    lat: card.lat,
    lng: card.lng,
    linkedAt,
    ...(card.type != null ? { type: card.type } : {}),
    ...(card.addr !== undefined ? { addr: card.addr } : {}),
    ...(card.thumbUrl !== undefined ? { thumbUrl: card.thumbUrl } : {}),
  }
}

export function optimisticLinkedRefs(
  ids: readonly string[],
  existing: readonly LinkedReportRef[],
  cards: Readonly<Record<string, LinkedReportCardEntry | undefined>>,
  linkedAt: string,
): LinkedReportRef[] {
  const byId = new Map(existing.map((ref) => [ref.id, ref]))
  const out: LinkedReportRef[] = []
  for (const id of ids) {
    const kept = byId.get(id)
    if (kept) {
      out.push(kept)
      continue
    }
    const card = cards[id]
    if (card) out.push(refFromCard(card, linkedAt))
  }
  return out
}

export function mergePins(...groups: ReadonlyArray<readonly ReportPinDTO[]>): ReportPinDTO[] {
  const byId = new Map<string, ReportPinDTO>()
  for (const group of groups) {
    for (const pin of group) {
      if (!pin || !Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) continue
      const prev = byId.get(pin.id)
      byId.set(pin.id, prev ? { ...prev, ...pin } : pin)
    }
  }
  return [...byId.values()]
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const REFERENCE_CODE_PATTERN = /^[a-z]{2,4}-\d{1,6}-\d{6}$/i
export const SHORT_ID_LENGTH = 8

export function reportLookupKey(query: string): string | null {
  const q = query.trim()
  if (UUID_PATTERN.test(q)) return q.toLowerCase()
  if (REFERENCE_CODE_PATTERN.test(q)) return q.toUpperCase()
  return null
}

export function reportShortCode(report: { id: string; referenceCode?: string | null }): string {
  const reference = report.referenceCode?.trim()
  return `#${reference || report.id.slice(0, SHORT_ID_LENGTH)}`
}

export const QUERY_RANK = {
  exactId: 0,
  idPrefix: 1,
  titlePrefix: 2,
  titleWord: 3,
  titleContains: 4,
  otherFields: 5,
} as const

export type QueryRank = (typeof QUERY_RANK)[keyof typeof QUERY_RANK]

function normalize(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase()
}

export function queryRank(pin: ReportPinDTO, query: string): QueryRank | null {
  const q = normalize(query)
  if (q.length === 0) return QUERY_RANK.otherFields
  const id = pin.id.toLowerCase()
  const reference = normalize(pin.referenceCode)
  if (q === id || (reference.length > 0 && q === reference)) return QUERY_RANK.exactId
  if (id.startsWith(q) || (reference.length > 0 && reference.startsWith(q))) return QUERY_RANK.idPrefix
  const title = normalize(pin.title)
  const tokens = q.split(/\s+/).filter(Boolean)
  if (title.length > 0) {
    if (title.startsWith(q)) return QUERY_RANK.titlePrefix
    const words = title.split(/[^a-z0-9]+/i).filter(Boolean)
    if (tokens.every((token) => words.some((word) => word.startsWith(token)))) return QUERY_RANK.titleWord
    if (tokens.every((token) => title.includes(token))) return QUERY_RANK.titleContains
  }
  const rest = [pin.description, pin.addr, reference, id]
    .map(normalize)
    .filter((part) => part.length > 0)
    .join(" ")
  if (tokens.every((token) => rest.includes(token) || title.includes(token))) return QUERY_RANK.otherFields
  return null
}

export function matchesQuery(pin: ReportPinDTO, query: string): boolean {
  return queryRank(pin, query) !== null
}

export type PickerRowPlace = "linked" | "view" | "matches"

export interface PickerRow {
  pin: ReportPinDTO
  distanceM: number
  state: PickerPinState
  place: PickerRowPlace
  rank: QueryRank
}

export interface PickerFilter {
  center: LatLng
  categories: ReadonlySet<ReportCategory>
  nearbyOnly: boolean
  radiusM: number
  query: string
}

export interface PickerFit {
  rank: QueryRank
  distanceM: number
  passes: boolean
}

export function pickerFit(pin: ReportPinDTO, filter: PickerFilter): PickerFit | null {
  const rank = queryRank(pin, filter.query)
  if (rank === null) return null
  const distanceM = haversineMeters(filter.center, { lat: pin.lat, lng: pin.lng })
  const withinRadius = !filter.nearbyOnly || distanceM <= filter.radiusM
  const exact = rank === QUERY_RANK.exactId
  return { rank, distanceM, passes: exact || (filter.categories.has(pin.category) && withinRadius) }
}

export interface PickerRowsInput extends PickerFilter {
  pins: readonly ReportPinDTO[]
  viewport: BBox | null
  ids: ReadonlySet<string>
  linked: ReadonlySet<string>
}

function compareById(a: PickerRow, b: PickerRow): number {
  return a.pin.id < b.pin.id ? -1 : a.pin.id > b.pin.id ? 1 : 0
}

function compareByDistance(a: PickerRow, b: PickerRow): number {
  if (a.distanceM !== b.distanceM) return a.distanceM - b.distanceM
  return compareById(a, b)
}

function compareByRank(a: PickerRow, b: PickerRow): number {
  if (a.rank !== b.rank) return a.rank - b.rank
  return compareByDistance(a, b)
}

export function isSearching(query: string): boolean {
  return query.trim().length > 0
}

export function pickerRows(input: PickerRowsInput): PickerRow[] {
  const rows: PickerRow[] = []
  const searching = isSearching(input.query)
  for (const pin of input.pins) {
    const fit = pickerFit(pin, input)
    if (!fit) continue
    const state = pinState(pin.id, input.ids, input.linked)
    const wasLinked = state === "linked" || state === "unlinking"
    const pinned = state !== "idle"
    if (!fit.passes && !pinned) continue
    const inView = input.viewport ? bboxHolds(input.viewport, pin) : true
    if (!pinned && !inView && !searching) continue
    rows.push({
      pin,
      distanceM: fit.distanceM,
      state,
      rank: fit.rank,
      place: searching ? "matches" : wasLinked ? "linked" : "view",
    })
  }
  rows.sort(searching ? compareByRank : compareByDistance)
  return rows
}

export interface PickerSections {
  linked: PickerRow[]
  view: PickerRow[]
  matches: PickerRow[]
}

export const SECTION_ORDER: readonly PickerRowPlace[] = ["matches", "linked", "view"]

export function pickerSections(rows: readonly PickerRow[]): PickerSections {
  const out: PickerSections = { linked: [], view: [], matches: [] }
  for (const row of rows) out[row.place].push(row)
  return out
}

export type PickerListItem =
  | { kind: "header"; key: string; place: PickerRowPlace; count: number }
  | { kind: "row"; key: string; row: PickerRow }

export interface PickerPage {
  items: PickerListItem[]
  shown: number
  total: number
}

export function pickerListItems(sections: PickerSections, limit = Number.POSITIVE_INFINITY): PickerPage {
  const items: PickerListItem[] = []
  let shown = 0
  let total = 0
  for (const place of SECTION_ORDER) {
    const rows = sections[place]
    total += rows.length
    if (rows.length === 0 || shown >= limit) continue
    items.push({ kind: "header", key: `h:${place}`, place, count: rows.length })
    for (const row of rows) {
      if (shown >= limit) break
      items.push({ kind: "row", key: `r:${row.pin.id}`, row })
      shown++
    }
  }
  return { items, shown, total }
}

export function rowIndexOf(items: readonly PickerListItem[], id: string): number {
  return items.findIndex((item) => item.kind === "row" && item.row.pin.id === id)
}

export function rowOrdinalOf(items: readonly PickerListItem[], id: string): number {
  let ordinal = 0
  for (const item of items) {
    if (item.kind !== "row") continue
    if (item.row.pin.id === id) return ordinal
    ordinal++
  }
  return -1
}

export function nextPageSize(shown: number, total: number, step = PICKER_PAGE_STEP): number {
  return Math.min(total, shown + step)
}

export type LoadMoreState = "hidden" | "more" | "fetch" | "loading"

export function loadMoreState(input: {
  shown: number
  total: number
  searching: boolean
  hasNextPage: boolean
  fetchingNextPage: boolean
}): LoadMoreState {
  if (input.shown < input.total) return "more"
  if (!input.searching || !input.hasNextPage) return "hidden"
  return input.fetchingNextPage ? "loading" : "fetch"
}

export function categoryCounts(
  pins: readonly ReportPinDTO[],
  viewport: BBox | null,
): Partial<Record<ReportCategory, number>> {
  const counts: Partial<Record<ReportCategory, number>> = {}
  for (const pin of pins) {
    if (viewport && !bboxHolds(viewport, pin)) continue
    counts[pin.category] = (counts[pin.category] ?? 0) + 1
  }
  return counts
}

export function keptPinIds(
  pins: readonly ReportPinDTO[],
  chosen: ReadonlySet<string>,
  filter: PickerFilter,
): string[] {
  const out: string[] = []
  for (const pin of pins) {
    if (!chosen.has(pin.id)) continue
    const fit = pickerFit(pin, filter)
    if (fit && !fit.passes) out.push(pin.id)
  }
  return out.sort()
}

export function mapPinsFor(
  pins: readonly ReportPinDTO[],
  keep: ReadonlySet<string>,
  filter: PickerFilter,
  max = PICKER_MAX_PINS,
): ReportPinDTO[] {
  const out: ReportPinDTO[] = []
  for (const pin of pins) {
    const fit = pickerFit(pin, filter)
    if (!fit) continue
    if (!fit.passes && !keep.has(pin.id)) continue
    out.push(pin)
    if (out.length >= max) break
  }
  return out
}

export interface SelectionDiff {
  selected: number
  added: number
  removed: number
  dirty: boolean
}

export function selectionDiff(
  ids: readonly string[],
  linked: ReadonlySet<string>,
): SelectionDiff {
  let added = 0
  const chosen = new Set(ids)
  for (const id of ids) if (!linked.has(id)) added++
  let removed = 0
  for (const id of linked) if (!chosen.has(id)) removed++
  return { selected: ids.length, added, removed, dirty: added > 0 || removed > 0 }
}

export type PickerMode = "draft" | "commit"

export type PickerStateKey = PickerPinState | "added" | "removed"

export function pinStateKey(state: PickerPinState, mode: PickerMode): PickerStateKey {
  if (mode !== "draft") return state
  if (state === "linked") return "added"
  if (state === "unlinking") return "removed"
  return state
}

export type PickerRowTagKey =
  | "row_linked_tag"
  | "row_added_tag"
  | "row_unlinking_tag"
  | "row_removed_tag"

export function rowTagKey(state: PickerPinState, mode: PickerMode): PickerRowTagKey | null {
  if (state === "linked") return mode === "draft" ? "row_added_tag" : "row_linked_tag"
  if (state === "unlinking") return mode === "draft" ? "row_removed_tag" : "row_unlinking_tag"
  return null
}

export type PickerFooterRemovedKey = "footer_removed" | "footer_deselected"

export function footerRemovedKey(mode: PickerMode): PickerFooterRemovedKey {
  return mode === "draft" ? "footer_deselected" : "footer_removed"
}

export type PickerActionKey = "action_done" | "action_link" | "action_save"

export interface PickerAction {
  key: PickerActionKey
  count: number
  enabled: boolean
}

export function pickerAction(mode: PickerMode, diff: SelectionDiff, busy: boolean): PickerAction {
  if (!diff.dirty) return { key: "action_done", count: diff.selected, enabled: !busy }
  if (mode === "commit") return { key: "action_save", count: diff.selected, enabled: !busy }
  return { key: "action_link", count: diff.selected, enabled: !busy }
}

export type PickerToggleOutcome = "added" | "removed" | "at_limit"

export interface PickerToggleResult {
  ids: string[]
  outcome: PickerToggleOutcome
}

export function togglePickerId(
  ids: readonly string[],
  id: string,
  max = MAX_LINKED_REPORTS,
): PickerToggleResult {
  if (ids.includes(id)) return { ids: ids.filter((x) => x !== id), outcome: "removed" }
  if (ids.length >= max) return { ids: [...ids], outcome: "at_limit" }
  return { ids: [...ids, id], outcome: "added" }
}

export type PickerPinTap = "focus" | "toggle"

export function pinTapIntent(id: string, focusedId: string | null): PickerPinTap {
  return focusedId === id ? "toggle" : "focus"
}

export type PickerListState =
  | "loading"
  | "error"
  | "too_wide"
  | "no_layers"
  | "no_match"
  | "empty"
  | "rows"

export function pickerListState(input: {
  hasRegion: boolean
  pending: boolean
  error: boolean
  searching: boolean
  pinCount: number
  layerCount: number
  rowCount: number
}): PickerListState {
  if (input.rowCount > 0) return "rows"
  if (input.error) return "error"
  if (input.pending && (input.pinCount === 0 || input.searching)) return "loading"
  if (input.searching) return "no_match"
  if (!input.hasRegion) return "too_wide"
  if (input.layerCount === 0) return "no_layers"
  return "empty"
}

/**
 * Which of the picker's queries failed. A failed search or code lookup is an error, not "no reports match"
 * for the typed query; a lookup that answers NOT_FOUND is the honest "no such code", so it is not a failure.
 */
export interface PickerQueryFailures {
  region: boolean
  search: boolean
  lookup: boolean
}

export function pickerQueryFailures(input: {
  regionError: boolean
  searching: boolean
  searchError: boolean
  lookupActive: boolean
  lookupError: boolean
  lookupErrorCode?: string | undefined
}): PickerQueryFailures {
  return {
    region: input.regionError,
    search: input.searching && input.searchError,
    lookup: input.lookupActive && input.lookupError && input.lookupErrorCode !== "NOT_FOUND",
  }
}
