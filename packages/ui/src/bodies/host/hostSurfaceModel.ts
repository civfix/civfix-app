import type { HostStage } from "@civfix/shared/host"
import type {
  ArrivalOffsetBucket,
  CleanupDTO,
  EventInsights,
  EventPhase,
  HostedEventDTO,
  InsightsSourceCount,
  SeatPoint,
} from "@civfix/shared"
import { hasHostCapability, type HostStandingView } from "../../data/hooks/host"
import type { SparkPoint } from "../../primitives/trendSparklineModel"
import type { IconName } from "../../typography/icon-map"
import { linkSheetMode } from "../linkReportsModel"

export const ANNOUNCE_CTA_WINDOW_MS = 48 * 3_600_000

// relativeAgo answers "" for a timestamp it cannot parse; phrasing that would leave "Starts in " hanging.
export function relativeLineFor(
  relative: string,
  phrase: (relative: string) => string,
): string | null {
  return relative === "" ? null : phrase(relative)
}

export const ARRIVAL_BUCKET_MINUTES = 15

export const MAX_ARRIVAL_SPARK_BUCKETS = 32

export type HostCtaKey =
  | "share"
  | "announce"
  | "check_in"
  | "scan"
  | "log_hours"
  | "duplicate"
  | "edit"

export type HostTileKey =
  | "waitlist"
  | "cancelled"
  | "spots_left"
  | "messages"
  | "expected"
  | "walkups"
  | "no_shows"
  | "not_marked"
  | "hours"
  | "returning"

export type HostCardKey = "grow" | "communicate" | "operate" | "configure" | "danger"

export type HostRowKey =
  | "share"
  | "chat"
  | "announce"
  | "check_in"
  | "scan"
  | "walkup"
  | "mark_no_shows"
  | "log_hours"
  | "edit"
  | "team"
  | "tickets"
  | "resources"
  | "duplicate"
  | "linked_reports"
  | "cancel"

export const HOST_ROW_ICONS: Readonly<Record<HostRowKey, IconName>> = {
  share: "Link2",
  chat: "MessageCircle",
  announce: "Megaphone",
  check_in: "QrCode",
  scan: "ScanLine",
  walkup: "UserPlus",
  mark_no_shows: "CheckCheck",
  log_hours: "Clock",
  edit: "Pencil",
  team: "Users",
  tickets: "Ticket",
  resources: "Building2",
  duplicate: "Copy",
  linked_reports: "MapPin",
  cancel: "Ban",
}

export type HostHeroKey = "registered" | "checked_in" | "attended"

export interface HostSurfaceCapabilities {
  checkIn: boolean
  broadcast: boolean
  manageEvent: boolean
  manageTickets: boolean
  manageTeam: boolean
  viewRoster: boolean
  viewAnalytics: boolean
  cancelEvent: boolean
  requestResources: boolean
  logHours: boolean
}

export function hostSurfaceCapabilities(
  standing: HostStandingView | null,
): HostSurfaceCapabilities {
  return {
    checkIn: hasHostCapability(standing, "check_in"),
    broadcast: hasHostCapability(standing, "broadcast"),
    manageEvent: hasHostCapability(standing, "manage_event"),
    manageTickets: hasHostCapability(standing, "manage_tickets"),
    manageTeam: hasHostCapability(standing, "manage_team"),
    viewRoster: hasHostCapability(standing, "view_roster"),
    viewAnalytics: hasHostCapability(standing, "view_analytics"),
    cancelEvent: hasHostCapability(standing, "cancel_event"),
    requestResources: hasHostCapability(standing, "request_resources"),
    logHours: hasHostCapability(standing, "manage_event"),
  }
}

export interface HostSurfaceInput {
  stage: HostStage
  now: number
  startsAt: number | null
  registeredSeats: number
  hoursCredited: number
  scannerAvailable: boolean
  can: HostSurfaceCapabilities
}

export interface HostActionInput {
  stage: HostStage
  ctas: readonly (HostCtaKey | null)[]
  can: HostSurfaceCapabilities
  unmarked: number
  scannerAvailable: boolean
  hasOrganization: boolean
  consoleReachable: boolean
  isCleanup: boolean
  linkedReportCount: number
}

export interface HostActionCard {
  key: HostCardKey
  rows: readonly HostRowKey[]
}

export interface HostPanels {
  hero: boolean
  tiles: boolean
  shifts: boolean
  topVolunteers: boolean
  signups: boolean
  byTicketType: boolean
  arrivals: boolean
  messages: boolean
}

export interface HostHero {
  key: HostHeroKey
  value: number
  limit: number | null
}

export interface HostTile {
  key: HostTileKey
  value: number
  total: number | null
}

function checkInCta(input: HostSurfaceInput): HostCtaKey | null {
  if (!input.can.checkIn) return null
  return input.scannerAvailable ? "scan" : "check_in"
}

function logHoursCta(input: HostSurfaceInput): HostCtaKey | null {
  return input.can.logHours && input.hoursCredited === 0 ? "log_hours" : null
}

export function hostPrimaryCta(input: HostSurfaceInput): HostCtaKey | null {
  const { can, stage } = input
  if (stage === "cancelled") return null
  if (stage === "past") return logHoursCta(input) ?? (can.manageEvent ? "duplicate" : null)
  if (stage === "wrapping_up") return logHoursCta(input) ?? checkInCta(input) ?? "share"
  if (stage === "soon" || stage === "underway") {
    return checkInCta(input) ?? (can.broadcast ? "announce" : "share")
  }
  const soon = input.startsAt !== null && input.startsAt - input.now <= ANNOUNCE_CTA_WINDOW_MS
  if (can.broadcast && soon && input.registeredSeats > 0) return "announce"
  return "share"
}

export function hostSecondaryCta(input: HostSurfaceInput): HostCtaKey | null {
  const { can, stage } = input
  const primary = hostPrimaryCta(input)
  const announce = can.broadcast && primary !== "announce" ? "announce" : null
  const edit = can.manageEvent ? "edit" : null
  if (stage === "cancelled") return can.manageEvent ? "duplicate" : null
  if (stage === "upcoming") return edit
  if (stage === "soon") return announce ?? edit
  if (stage === "underway") return announce
  if (stage === "wrapping_up") {
    const checkIn = checkInCta(input)
    return checkIn !== null && primary !== checkIn ? checkIn : announce
  }
  if (announce !== null) return announce
  return can.logHours && primary !== "log_hours" ? "log_hours" : null
}

export function hostPanels(phase: EventPhase): HostPanels {
  return {
    hero: true,
    tiles: phase !== "cancelled",
    shifts: phase === "upcoming" || phase === "live",
    topVolunteers: phase === "ended",
    signups: phase === "upcoming",
    byTicketType: phase === "upcoming",
    arrivals: phase === "live" || phase === "ended",
    messages: phase === "upcoming" || phase === "ended",
  }
}

export function hostHero(insights: EventInsights, phase: EventPhase): HostHero {
  const { seats } = insights
  if (phase === "live") return { key: "checked_in", value: seats.checkedIn, limit: seats.registered }
  if (phase === "ended") return { key: "attended", value: seats.checkedIn, limit: seats.registered }
  return { key: "registered", value: seats.registered, limit: seats.capacity }
}

export function attendanceRate(insights: EventInsights): number | null {
  const { registered, checkedIn } = insights.seats
  if (registered <= 0) return null
  return checkedIn / registered
}

export function spotsLeft(insights: EventInsights): number | null {
  const { capacity, registered } = insights.seats
  if (capacity === null) return null
  return Math.max(0, capacity - registered)
}

export function stillExpected(insights: EventInsights): number {
  const { registered, checkedIn, noShow } = insights.seats
  return Math.max(0, registered - checkedIn - noShow)
}

export function sourceSeats(
  bySource: readonly InsightsSourceCount[],
  source: InsightsSourceCount["source"],
): number {
  return bySource.find((entry) => entry.source === source)?.seats ?? 0
}

export function hoursHintHasDenominator(credited: number, attended: number): boolean {
  return attended > 0 && credited <= attended
}

export function hostStatTiles(insights: EventInsights, phase: EventPhase): HostTile[] {
  const { seats } = insights
  const tiles: HostTile[] = []
  const push = (key: HostTileKey, value: number, total: number | null = null) =>
    tiles.push({ key, value, total })

  if (phase === "upcoming") {
    push("waitlist", seats.waitlisted)
    push("cancelled", seats.cancelled)
    const left = spotsLeft(insights)
    if (left !== null) push("spots_left", left)
    push("messages", insights.broadcasts.length)
    return tiles
  }

  if (phase === "live") {
    push("expected", stillExpected(insights))
    push("walkups", sourceSeats(insights.bySource, "walkup"))
    push("no_shows", seats.noShow)
    push("waitlist", seats.waitlisted)
    return tiles
  }

  if (phase === "ended") {
    push("no_shows", seats.noShow)
    if (seats.unmarked > 0) push("not_marked", seats.unmarked)
    push("hours", insights.hours.credited, insights.hours.attendeesCheckedIn)
    if (insights.returning !== null) {
      push("returning", insights.returning.seats, insights.returning.ofRegistered)
    }
    return tiles
  }

  return tiles
}

const CTA_ROW: Readonly<Record<HostCtaKey, HostRowKey>> = {
  share: "share",
  announce: "announce",
  check_in: "check_in",
  scan: "scan",
  log_hours: "log_hours",
  duplicate: "duplicate",
  edit: "edit",
}

export function ctaRowKeys(ctas: readonly (HostCtaKey | null)[]): ReadonlySet<HostRowKey> {
  const out = new Set<HostRowKey>()
  for (const cta of ctas) {
    if (cta !== null) out.add(CTA_ROW[cta])
  }
  return out
}

export function hostActionCards(input: HostActionInput): HostActionCard[] {
  const { can, stage } = input
  const shown = ctaRowKeys(input.ctas)
  const cancelled = stage === "cancelled"
  const before = stage === "upcoming" || stage === "soon"
  const running = stage === "soon" || stage === "underway" || stage === "wrapping_up"
  const after = stage === "wrapping_up" || stage === "past"
  const editable = before || stage === "underway"

  const grow: HostRowKey[] = []
  if (!cancelled) grow.push("share")

  const communicate: HostRowKey[] = []
  if (!cancelled) communicate.push("chat")
  if (!cancelled && can.broadcast) communicate.push("announce")

  const operate: HostRowKey[] = []
  if (running && can.checkIn) operate.push(input.scannerAvailable ? "scan" : "check_in")
  if (running && can.manageTickets) operate.push("walkup")
  if (after && can.logHours) operate.push("log_hours")
  if (after && can.checkIn && input.unmarked > 0) operate.push("mark_no_shows")

  const configure: HostRowKey[] = []
  if (editable && can.manageEvent) configure.push("edit")
  if (
    linkSheetMode({
      stage,
      canManage: can.manageEvent,
      isCleanup: input.isCleanup,
      linkedCount: input.linkedReportCount,
    }) !== "hidden"
  ) {
    configure.push("linked_reports")
  }
  if (!cancelled && can.manageTeam) configure.push("team")
  if (before && can.manageTickets && input.consoleReachable) configure.push("tickets")
  if (before && can.requestResources && input.hasOrganization) configure.push("resources")
  if ((stage === "past" || cancelled) && can.manageEvent) configure.push("duplicate")

  const danger: HostRowKey[] = []
  if (editable && can.cancelEvent) danger.push("cancel")

  const cards: HostActionCard[] = [
    { key: "grow", rows: grow },
    { key: "communicate", rows: communicate },
    { key: "operate", rows: operate },
    { key: "configure", rows: configure },
    { key: "danger", rows: danger },
  ]
  return cards
    .map((card) => ({ key: card.key, rows: card.rows.filter((row) => !shown.has(row)) }))
    .filter((card) => card.rows.length > 0)
}

export function registrationTrendPoints(trend: readonly SeatPoint[]): SparkPoint[] {
  return trend.map((point) => ({ key: point.day, value: point.seats }))
}

function bucketOffset(offsetMin: number): number {
  return Math.round(offsetMin / ARRIVAL_BUCKET_MINUTES) * ARRIVAL_BUCKET_MINUTES
}

export function arrivalSparkPoints(arrivals: readonly ArrivalOffsetBucket[]): SparkPoint[] {
  if (arrivals.length === 0) return []
  const totals = new Map<number, number>()
  for (const bucket of arrivals) {
    const offset = bucketOffset(bucket.offsetMin)
    totals.set(offset, (totals.get(offset) ?? 0) + bucket.seats)
  }
  const offsets = [...totals.keys()].sort((a, b) => a - b)
  const first = offsets[0] as number
  const last = offsets[offsets.length - 1] as number
  const span = Math.floor((last - first) / ARRIVAL_BUCKET_MINUTES) + 1
  const start =
    span > MAX_ARRIVAL_SPARK_BUCKETS
      ? last - (MAX_ARRIVAL_SPARK_BUCKETS - 1) * ARRIVAL_BUCKET_MINUTES
      : first
  const points: SparkPoint[] = []
  for (let offset = start; offset <= last; offset += ARRIVAL_BUCKET_MINUTES) {
    points.push({ key: String(offset), value: totals.get(offset) ?? 0 })
  }
  return points
}

export function peakArrival(arrivals: readonly ArrivalOffsetBucket[]): ArrivalOffsetBucket | null {
  let peak: ArrivalOffsetBucket | null = null
  for (const bucket of arrivals) {
    if (bucket.seats <= 0) continue
    if (peak === null || bucket.seats > peak.seats) peak = bucket
  }
  return peak
}

export function arrivalOffsetLabel(offsetMin: number): string {
  const sign = offsetMin < 0 ? "-" : "+"
  const total = Math.abs(offsetMin)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return `${sign}${minutes}m`
  if (minutes === 0) return `${sign}${hours}h`
  return `${sign}${hours}h ${minutes}m`
}

export function hostedEventFromCleanup(
  cleanup: CleanupDTO,
  insights: EventInsights | null,
): HostedEventDTO {
  return {
    id: cleanup.id,
    referenceCode: cleanup.referenceCode ?? null,
    title: cleanup.title,
    startsAt: cleanup.scheduledAt,
    endsAt: cleanup.endsAt ?? null,
    timezone: cleanup.timezone ?? null,
    status: cleanup.status,
    visibility: cleanup.visibility,
    coverThumbUrl: cleanup.coverUrl ?? null,
    registeredCount: insights?.seats.registered ?? cleanup.registeredCount ?? 0,
    capacity: insights?.seats.capacity ?? cleanup.capacity ?? null,
    checkedInCount: insights?.seats.checkedIn ?? cleanup.checkedInCount ?? 0,
    waitlistCount: insights?.seats.waitlisted ?? cleanup.waitlistCount ?? 0,
    myRole: cleanup.myRole ?? null,
    myCapabilities: cleanup.myCapabilities,
    orgId: cleanup.organization?.id ?? null,
    orgName: cleanup.organization?.name ?? null,
    pageSlug: cleanup.pageSlug ?? null,
    pageStatus: cleanup.pageStatus ?? null,
  }
}
