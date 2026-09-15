import type { CleanupDTO, PersonDTO, ReportPinDTO } from "@civfix/shared"

export type View = "home" | "map" | "events" | "messaging" | "social" | "reports" | "search" | "report"

export const ALL_VIEWS = [
  "home",
  "map",
  "events",
  "messaging",
  "social",
  "reports",
  "search",
  "report",
] as const satisfies readonly View[]

export type DetailKind =
  | "pin"
  | "cleanup"
  | "person"
  | "thread"
  | "myreports"
  | "cleanups"
  | "people"
  | "messages"
  | "new-msg"
  | "activity"
  | "notification-prefs"
  | "profile"
  | "create-cleanup"
  | "edit-cleanup"
  | "cluster"
  | "blend"
  | "followers"
  | "following"
  | "leaderboard"
  | "blocked"
  | "members"
  | "language-settings"
  | "appearance-settings"
  | "settings"
  | "settings-account"
  | "settings-privacy"
  | "pinned-messages"
  | "new-group"
  | "new-channel"
  | "group-info"
  | "post"
  | "post-thread"
  | "composer"
  | "saves"
  | "drop-pin"
  | "host-mode"
  | "host-checkin"
  | "host-broadcast-quick"
  | "host-team"
  | "host-log-hours"
  | "my-ticket"
  | "org"
  | "my-donations"
  | "event-dashboard"

export const ALL_DETAIL_KINDS = [
  "pin",
  "cleanup",
  "person",
  "thread",
  "myreports",
  "cleanups",
  "people",
  "messages",
  "new-msg",
  "activity",
  "notification-prefs",
  "profile",
  "create-cleanup",
  "edit-cleanup",
  "cluster",
  "blend",
  "followers",
  "following",
  "leaderboard",
  "blocked",
  "members",
  "language-settings",
  "appearance-settings",
  "settings",
  "settings-account",
  "settings-privacy",
  "pinned-messages",
  "new-group",
  "new-channel",
  "group-info",
  "post",
  "post-thread",
  "composer",
  "saves",
  "drop-pin",
  "host-mode",
  "host-checkin",
  "host-broadcast-quick",
  "host-team",
  "host-log-hours",
  "my-ticket",
  "org",
  "my-donations",
  "event-dashboard",
] as const satisfies readonly DetailKind[]

export const DEAD_DETAIL_KINDS = ["new-msg"] as const satisfies readonly DetailKind[]

type AssertExhaustive<Union extends string, Arr extends readonly string[]> = [Union] extends [Arr[number]]
  ? [Arr[number]] extends [Union]
    ? true
    : false
  : false
type _ViewsExhaustive = AssertExhaustive<View, typeof ALL_VIEWS>
type _KindsExhaustive = AssertExhaustive<DetailKind, typeof ALL_DETAIL_KINDS>
const _viewsExhaustive = true satisfies _ViewsExhaustive
const _kindsExhaustive = true satisfies _KindsExhaustive
void _viewsExhaustive
void _kindsExhaustive

export interface DetailEntry {
  kind: DetailKind | "view"
  view?: Extract<View, "map" | "search" | "report">
  id?: string
  roomKind?: "cleanup" | "dm" | "report" | "group"
  peer?: PersonDTO
  title?: string
  lat?: number
  lng?: number
  reportId?: string
  reports?: ReportPinDTO[]
  event?: CleanupDTO
  geoid?: string
  jumpToMessageId?: string
  composerMode?: "post" | "quote" | "reply"
  targetPostId?: string
  profileTab?: "posts" | "events" | "hours" | "reports"
  slug?: string
  seatId?: string
  organizationId?: string
}

export type Snap = 0 | 1 | 2

export interface NavState {
  view: View
  stack: DetailEntry[]
  active: DetailEntry | null
  snap: Snap
  query: string
}
