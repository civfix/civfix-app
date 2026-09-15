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
export const PICKER_SEARCH_MIN_CHARS = 2

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

export function matchesQuery(pin: ReportPinDTO, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  const haystack = [pin.title, pin.description, pin.addr, pin.referenceCode]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ")
    .toLowerCase()
  return tokens.every((token) => haystack.includes(token))
}

export type PickerRowPlace = "linked" | "view" | "elsewhere"

export interface PickerRow {
  pin: ReportPinDTO
  distanceM: number
  state: PickerPinState
  place: PickerRowPlace
}

export interface PickerRowsInput {
  pins: readonly ReportPinDTO[]
  center: LatLng
  viewport: BBox | null
  ids: ReadonlySet<string>
  linked: ReadonlySet<string>
  categories: ReadonlySet<ReportCategory>
  nearbyOnly: boolean
  radiusM: number
  query: string
}

function compareRows(a: PickerRow, b: PickerRow): number {
  if (a.distanceM !== b.distanceM) return a.distanceM - b.distanceM
  return a.pin.id < b.pin.id ? -1 : a.pin.id > b.pin.id ? 1 : 0
}

export function pickerRows(input: PickerRowsInput): PickerRow[] {
  const rows: PickerRow[] = []
  const searching = input.query.trim().length > 0
  for (const pin of input.pins) {
    const state = pinState(pin.id, input.ids, input.linked)
    const wasLinked = state === "linked" || state === "unlinking"
    const pinned = state !== "idle"
    if (!pinned && !input.categories.has(pin.category)) continue
    if (!matchesQuery(pin, input.query)) continue
    const distanceM = haversineMeters(input.center, { lat: pin.lat, lng: pin.lng })
    if (!pinned && input.nearbyOnly && distanceM > input.radiusM) continue
    const inView = input.viewport ? bboxHolds(input.viewport, pin) : true
    if (!pinned && !inView && !searching) continue
    rows.push({
      pin,
      distanceM,
      state,
      place: wasLinked ? "linked" : inView || state === "selected" ? "view" : "elsewhere",
    })
  }
  rows.sort(compareRows)
  return rows
}

export interface PickerSections {
  linked: PickerRow[]
  view: PickerRow[]
  elsewhere: PickerRow[]
}

export function pickerSections(rows: readonly PickerRow[]): PickerSections {
  const out: PickerSections = { linked: [], view: [], elsewhere: [] }
  for (const row of rows) out[row.place].push(row)
  return out
}

export type PickerListItem =
  | { kind: "header"; key: string; place: PickerRowPlace; count: number }
  | { kind: "row"; key: string; row: PickerRow }

export function pickerListItems(sections: PickerSections): PickerListItem[] {
  const items: PickerListItem[] = []
  const push = (place: PickerRowPlace, rows: readonly PickerRow[]) => {
    if (rows.length === 0) return
    items.push({ kind: "header", key: `h:${place}`, place, count: rows.length })
    for (const row of rows) items.push({ kind: "row", key: `r:${row.pin.id}`, row })
  }
  push("linked", sections.linked)
  push("view", sections.view)
  push("elsewhere", sections.elsewhere)
  return items
}

export function rowIndexOf(items: readonly PickerListItem[], id: string): number {
  return items.findIndex((item) => item.kind === "row" && item.row.pin.id === id)
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

export function mapPinsFor(
  pins: readonly ReportPinDTO[],
  linked: ReadonlySet<string>,
  categories: ReadonlySet<ReportCategory>,
  max = PICKER_MAX_PINS,
): ReportPinDTO[] {
  const out: ReportPinDTO[] = []
  for (const pin of pins) {
    if (!linked.has(pin.id) && !categories.has(pin.category)) continue
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
  | "empty"
  | "rows"

export function pickerListState(input: {
  hasRegion: boolean
  pending: boolean
  error: boolean
  pinCount: number
  layerCount: number
  rowCount: number
}): PickerListState {
  if (input.rowCount > 0) return "rows"
  if (input.error) return "error"
  if (input.pending && input.pinCount === 0) return "loading"
  if (!input.hasRegion) return "too_wide"
  if (input.layerCount === 0) return "no_layers"
  return "empty"
}
