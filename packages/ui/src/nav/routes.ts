import type { DetailEntry, DetailKind, LayoutMode, NavState, View } from "./types"

const UNADDRESSABLE_KINDS: readonly DetailKind[] = ["cluster", "blend", "drop-pin"]

export const ENTRY_IDENTITY_FIELDS = [
  "id",
  "roomKind",
  "geoid",
  "slug",
  "seatId",
  "announcementId",
] as const satisfies readonly (keyof DetailEntry)[]

export function entryDiscriminator(entry: DetailEntry): string {
  if (entry.kind === "composer") {
    return `composer:${entry.composerMode ?? "post"}:${entry.targetPostId ?? ""}`
  }
  return [entry.kind, ...ENTRY_IDENTITY_FIELDS.map((field) => entry[field] ?? "")].join(":")
}

export function entryIdentity(entry: DetailEntry | null | undefined): string | null {
  if (!entry) return null
  if (entry.kind === "view") return entry.view ? `view:${entry.view}` : null
  if (UNADDRESSABLE_KINDS.includes(entry.kind)) return null
  return entryDiscriminator(entry)
}

function normalizePath(path: string): string {
  const withoutHash = path.split("#")[0] ?? ""
  const withoutQuery = withoutHash.split("?")[0] ?? ""
  return withoutQuery.length > 1 && withoutQuery.endsWith("/")
    ? withoutQuery.slice(0, -1)
    : withoutQuery
}

function pathParts(path: string): string[] {
  return normalizePath(path)
    .split("/")
    .filter((p) => p && p !== "_")
}

export function isRootLink(path: string | null | undefined): boolean {
  return path === "/"
}

type AddressableView = NonNullable<DetailEntry["view"]>
type RoomKind = NonNullable<DetailEntry["roomKind"]>

const VIEW_PATHS: Record<AddressableView, string> = {
  map: "/map",
  search: "/search",
  report: "/report",
}

const ADDRESSABLE_VIEWS = Object.keys(VIEW_PATHS) as AddressableView[]
const ROOM_KINDS: readonly RoomKind[] = ["dm", "report", "cleanup", "group"]
// A cleanup thread is addressed as /messages/<id>; the other rooms carry their kind in the path.
const PREFIXED_THREAD_ROOMS: readonly RoomKind[] = ["dm", "report", "group"]

// A body that renders its own header. It is blank after trim, so the shell draws no DetailBar for it.
export const BODY_OWNS_HEADER = " "

type Captures = Readonly<Record<string, string>>

interface PathRoute {
  segments: readonly string[]
  to: (captures: Captures) => DetailEntry | null
}

// A ":name" segment captures that part; extra trailing parts are ignored, so the first matching route wins.
function route(pattern: string, to: PathRoute["to"]): PathRoute {
  return { segments: pattern.split("/"), to }
}

const messagesList = (): DetailEntry => ({ kind: "messages" })

const PATH_ROUTES: readonly PathRoute[] = [
  ...ADDRESSABLE_VIEWS.map((view) => route(view, (): DetailEntry => ({ kind: "view", view }))),
  route("pin/:id", ({ id }) => ({ kind: "pin", id })),
  route("cleanups/:id/edit", ({ id }) => ({ kind: "edit-cleanup", id })),
  route("cleanups/:id/host", ({ id }) => ({ kind: "host-mode", id })),
  route("cleanups/:id/checkin", ({ id }) => ({ kind: "host-checkin", id })),
  route("cleanups/:id/announce", ({ id }) => ({ kind: "host-announce", id })),
  route("cleanups/:id/team", ({ id }) => ({ kind: "host-team", id })),
  route("cleanups/:id/hours", ({ id }) => ({ kind: "host-log-hours", id })),
  route("cleanups/:id/analytics", ({ id }) => ({ kind: "event-analytics", id })),
  route("cleanups/:id/announcements/:announcementId", ({ id, announcementId }) => ({
    kind: "announcement",
    id,
    announcementId,
  })),
  route("cleanups/:id/announcements", ({ id }) => ({ kind: "announcements", id })),
  route("cleanups/:id/ticket/:seatId", ({ id, seatId }) => ({ kind: "my-ticket", id, seatId })),
  route("cleanups/:id/ticket", ({ id }) => ({ kind: "my-ticket", id })),
  route("cleanups/:id", ({ id }) => ({ kind: "cleanup", id })),
  route("cleanups", () => ({ kind: "cleanups" })),
  route("events", () => ({ kind: "cleanups" })),
  route("e/:id", ({ id }) => ({ kind: "cleanup", id })),
  route("orgs/:slug/manage", ({ slug }) => ({ kind: "org-manage", slug })),
  route("orgs/:slug", ({ slug }) => ({ kind: "org", slug })),
  route("people/:id/followers", ({ id }) => ({ kind: "followers", id })),
  route("people/:id/following", ({ id }) => ({ kind: "following", id })),
  route("people/:id", ({ id }) => ({ kind: "person", id })),
  route("people", () => ({ kind: "people" })),
  route("leaderboard/:geoid", ({ geoid }) => ({ kind: "leaderboard", geoid })),
  ...ROOM_KINDS.map((roomKind) =>
    route(`messages/pins/${roomKind}/:id`, ({ id }) => ({ kind: "pinned-messages", id, roomKind })),
  ),
  route("messages/pins", messagesList),
  ...ROOM_KINDS.map((roomKind) =>
    route(`messages/members/${roomKind}/:id`, ({ id }) => ({ kind: "members", id, roomKind })),
  ),
  route("messages/members", messagesList),
  ...PREFIXED_THREAD_ROOMS.map((roomKind) =>
    route(`messages/${roomKind}/:id`, ({ id }) => ({ kind: "thread", id, roomKind })),
  ),
  ...PREFIXED_THREAD_ROOMS.map((roomKind) => route(`messages/${roomKind}`, messagesList)),
  route("messages/:id", ({ id }) => ({ kind: "thread", id, roomKind: "cleanup" })),
  route("messages", messagesList),
  route("reports/:id", ({ id }) => ({ kind: "pin", id })),
  route("reports", () => ({ kind: "myreports" })),
  route("notifications/prefs", () => ({ kind: "notification-prefs" })),
  route("notifications", () => ({ kind: "activity" })),
  route("profile", () => ({ kind: "profile" })),
  route("settings/account", () => ({ kind: "settings-account" })),
  route("settings/privacy", () => ({ kind: "settings-privacy" })),
  route("settings/blocked", () => ({ kind: "blocked" })),
  route("settings/language", () => ({ kind: "language-settings" })),
  route("settings/appearance", () => ({ kind: "appearance-settings" })),
  route("settings/:section", () => null),
  route("settings", () => ({ kind: "settings" })),
  route("host/analytics", () => ({ kind: "host-analytics" })),
  route("host", () => ({ kind: "create-cleanup" })),
  route("groups/new", () => ({ kind: "new-group" })),
  route("groups/:id/info", ({ id }) => ({ kind: "group-info", id })),
  route("channels/new", () => ({ kind: "new-channel" })),
  route("dashboard", () => ({ kind: "event-dashboard" })),
  route("post/:id/thread", ({ id }) => ({ kind: "post-thread", id })),
  route("post/:id", ({ id }) => ({ kind: "post", id })),
  route("compose/quote/:targetPostId", ({ targetPostId }) => ({
    kind: "composer",
    composerMode: "quote",
    targetPostId,
  })),
  route("compose", () => ({ kind: "composer" })),
  route("saves", () => ({ kind: "saves" })),
]

function matchSegments(segments: readonly string[], parts: readonly string[]): Captures | null {
  const captures: Record<string, string> = {}
  const matches = segments.every((segment, index) => {
    const part = parts[index]
    if (part === undefined) return false
    if (!segment.startsWith(":")) return segment === part
    captures[segment.slice(1)] = part
    return true
  })
  return matches ? captures : null
}

export function entryFromPath(path: string | null | undefined): DetailEntry | null {
  if (!path) return null
  const parts = pathParts(path)
  for (const { segments, to } of PATH_ROUTES) {
    const captures = matchSegments(segments, parts)
    if (captures) return to(captures)
  }
  return null
}

type EntryText = string | ((entry: DetailEntry) => string)

interface KindRoute {
  path: EntryText
  title: EntryText
  /** The tab a detail of this kind belongs under. */
  parentView?: View
  /** The tab this kind is the list of, so a deep link to it selects that tab instead of pushing a detail. */
  listView?: View
}

function idPath(build: (id: string, entry: DetailEntry) => string, fallback: string): EntryText {
  return (entry) => (entry.id ? build(entry.id, entry) : fallback)
}

function cleanupPath(suffix: string, child?: "announcementId" | "seatId"): EntryText {
  return idPath((id, entry) => {
    const childId = child ? entry[child] : undefined
    return childId ? `/cleanups/${id}${suffix}/${childId}` : `/cleanups/${id}${suffix}`
  }, "/cleanups")
}

function orgPath(suffix: string): EntryText {
  return (entry) => (entry.slug ? `/orgs/${entry.slug}${suffix}` : "/")
}

function roomPath(section: "pins" | "members"): EntryText {
  return idPath((id, entry) => `/messages/${section}/${entry.roomKind ?? "cleanup"}/${id}`, "/messages")
}

const threadPath = idPath(
  (id, entry) =>
    entry.roomKind && PREFIXED_THREAD_ROOMS.includes(entry.roomKind)
      ? `/messages/${entry.roomKind}/${id}`
      : `/messages/${id}`,
  "/messages",
)

const KIND_ROUTES: Record<DetailKind, KindRoute> = {
  pin: { path: idPath((id) => `/pin/${id}`, "/"), title: "title.pin", parentView: "reports" },
  cleanup: { path: cleanupPath(""), title: "title.cleanup", parentView: "events" },
  person: { path: idPath((id) => `/people/${id}`, "/people"), title: BODY_OWNS_HEADER, parentView: "social" },
  thread: { path: threadPath, title: BODY_OWNS_HEADER, parentView: "messaging" },
  myreports: { path: "/reports", title: "title.myreports", parentView: "reports", listView: "reports" },
  cleanups: { path: "/cleanups", title: "title.cleanups", parentView: "events", listView: "events" },
  people: { path: "/people", title: "title.people", parentView: "social", listView: "social" },
  messages: { path: "/messages", title: "title.messages", parentView: "messaging", listView: "messaging" },
  "new-msg": { path: "/messages", title: "title.new_msg" },
  activity: { path: "/notifications", title: "title.activity" },
  "notification-prefs": { path: "/notifications/prefs", title: "title.notification_prefs" },
  profile: { path: "/profile", title: "title.profile" },
  "create-cleanup": { path: "/host", title: "title.create_cleanup" },
  "edit-cleanup": { path: cleanupPath("/edit"), title: "title.edit_cleanup" },
  cluster: { path: "/", title: "title.cluster" },
  blend: { path: "/", title: (entry) => entry.event?.title || "title.cleanup" },
  followers: { path: idPath((id) => `/people/${id}/followers`, "/people"), title: "title.followers" },
  following: { path: idPath((id) => `/people/${id}/following`, "/people"), title: "title.following" },
  leaderboard: {
    path: (entry) => (entry.geoid ? `/leaderboard/${entry.geoid}` : "/"),
    title: "title.leaderboard",
  },
  blocked: { path: "/settings/blocked", title: "title.blocked" },
  members: {
    path: roomPath("members"),
    title: (entry) =>
      entry.roomKind === "report" || entry.roomKind === "cleanup" ? "title.chat_info" : "title.members",
  },
  "language-settings": { path: "/settings/language", title: "title.language_settings" },
  "appearance-settings": { path: "/settings/appearance", title: "title.appearance_settings" },
  settings: { path: "/settings", title: "title.settings" },
  "settings-account": { path: "/settings/account", title: "title.settings_account" },
  "settings-privacy": { path: "/settings/privacy", title: "title.settings_privacy" },
  "pinned-messages": { path: roomPath("pins"), title: BODY_OWNS_HEADER, parentView: "messaging" },
  "new-group": { path: "/groups/new", title: BODY_OWNS_HEADER, parentView: "messaging" },
  "new-channel": { path: "/channels/new", title: BODY_OWNS_HEADER, parentView: "messaging" },
  "group-info": {
    path: idPath((id) => `/groups/${id}/info`, "/messages"),
    title: "title.group_info",
    parentView: "messaging",
  },
  post: { path: idPath((id) => `/post/${id}`, "/"), title: "title.post", parentView: "home" },
  "post-thread": { path: idPath((id) => `/post/${id}/thread`, "/"), title: BODY_OWNS_HEADER, parentView: "home" },
  composer: {
    path: (entry) =>
      entry.composerMode === "quote" && entry.targetPostId ? `/compose/quote/${entry.targetPostId}` : "/compose",
    title: BODY_OWNS_HEADER,
  },
  saves: { path: "/saves", title: "title.saves", parentView: "home" },
  "drop-pin": { path: VIEW_PATHS.map, title: "title.drop_pin", parentView: "map" },
  "host-mode": { path: cleanupPath("/host"), title: "title.host_mode", parentView: "events" },
  "host-checkin": { path: cleanupPath("/checkin"), title: "title.host_checkin", parentView: "events" },
  "host-announce": { path: cleanupPath("/announce"), title: "title.host_announce", parentView: "events" },
  "host-team": { path: cleanupPath("/team"), title: "title.host_team", parentView: "events" },
  "host-log-hours": { path: cleanupPath("/hours"), title: "title.host_log_hours", parentView: "events" },
  "my-ticket": { path: cleanupPath("/ticket", "seatId"), title: "title.my_ticket", parentView: "events" },
  org: { path: orgPath(""), title: "title.org", parentView: "events" },
  "event-dashboard": { path: "/dashboard", title: "title.event_dashboard", parentView: "events" },
  announcement: {
    path: cleanupPath("/announcements", "announcementId"),
    title: "title.announcement",
    parentView: "events",
  },
  announcements: { path: cleanupPath("/announcements"), title: "title.announcements", parentView: "events" },
  "event-analytics": { path: cleanupPath("/analytics"), title: "title.event_analytics", parentView: "events" },
  "host-analytics": { path: "/host/analytics", title: "title.host_analytics", parentView: "events" },
  "org-manage": { path: orgPath("/manage"), title: "title.org_manage", parentView: "events" },
}

// Entries restored from history or storage are typed but not guaranteed to carry a current kind.
function kindRoute(entry: DetailEntry): KindRoute | undefined {
  return entry.kind === "view" ? undefined : (KIND_ROUTES[entry.kind] as KindRoute | undefined)
}

function entryText(text: EntryText | undefined, entry: DetailEntry, fallback: string): string {
  if (text === undefined) return fallback
  return typeof text === "string" ? text : text(entry)
}

export function pathForEntry(entry: DetailEntry | null): string {
  if (!entry) return "/"
  if (entry.kind === "view") return entry.view ? pathForView(entry.view) ?? "/" : "/"
  return entryText(kindRoute(entry)?.path, entry, "/")
}

export type NavPlatform = "web" | "native"

// On web a shared /post link opens straight into its thread, and the thread is written back at that short
// address; native keeps /post as the post card. Each entry maps an aliased kind to the kind whose address
// it borrows.
const PLATFORM_ADDRESS_ALIASES: Record<NavPlatform, ReadonlyMap<DetailEntry["kind"], DetailKind>> = {
  native: new Map(),
  web: new Map([["post-thread", "post"]]),
}

export function entryFromPlatformPath(
  path: string | null | undefined,
  platform: NavPlatform,
): DetailEntry | null {
  const entry = entryFromPath(path)
  if (!entry?.id) return entry
  for (const [alias, borrowed] of PLATFORM_ADDRESS_ALIASES[platform]) {
    if (borrowed === entry.kind) return { kind: alias, id: entry.id }
  }
  return entry
}

export function platformPathForEntry(entry: DetailEntry, platform: NavPlatform): string {
  const borrowed = PLATFORM_ADDRESS_ALIASES[platform].get(entry.kind)
  return borrowed && entry.id ? pathForEntry({ kind: borrowed, id: entry.id }) : pathForEntry(entry)
}

export function pathForView(view: View): string | null {
  return (VIEW_PATHS as Partial<Record<View, string>>)[view] ?? null
}

export function viewFromPath(path: string | null | undefined): View | null {
  if (!path) return null
  const base = pathParts(path)[0]
  return ADDRESSABLE_VIEWS.find((view) => view === base) ?? null
}

export function titleForEntry(entry: DetailEntry | null): string {
  if (!entry) return ""
  return entryText(kindRoute(entry)?.title, entry, "")
}

export function titleParamsForEntry(entry: DetailEntry | null): { count?: number } {
  if (entry?.kind === "cluster") return { count: entry.reports?.length ?? 0 }
  return {}
}

export type HeaderMode = "search" | "detail"

export interface SearchSpec {
  mode: HeaderMode
  placeholder: string
  kind: "places" | "people" | "reports"
}

export function searchModeFor(view: View, active: DetailEntry | null): SearchSpec {
  if (active) {
    return { mode: "detail", placeholder: "", kind: placeholderKind(view).kind }
  }
  const k = placeholderKind(view)
  return { mode: "search", placeholder: k.placeholder, kind: k.kind }
}

function placeholderKind(view: View): { placeholder: string; kind: "places" | "people" | "reports" } {
  switch (view) {
    case "messaging":
    case "social":
      return { placeholder: "placeholder.people", kind: "people" }
    case "reports":
      return { placeholder: "placeholder.reports", kind: "reports" }
    case "search":
      return { placeholder: "placeholder.search", kind: "places" }
    default:
      return { placeholder: "placeholder.places_events", kind: "places" }
  }
}

export function viewForEntry(entry: DetailEntry | null): View | null {
  if (!entry) return null
  if (entry.kind === "view") return entry.view ?? null
  return kindRoute(entry)?.listView ?? null
}

export function parentViewForEntry(entry: DetailEntry | null): View | null {
  if (!entry) return null
  return kindRoute(entry)?.parentView ?? null
}

function baseViewForSeed(currentView: View): View {
  return currentView === "map" ? "home" : currentView
}

export function seedFor(
  entry: DetailEntry | null,
  _mode: LayoutMode,
  currentView: View = "home",
): Partial<NavState> {
  if (!entry) return {}
  if (entry.kind === "view" && entry.view) {
    return { view: entry.view, stack: [], snap: entry.view === "map" ? 0 : 2 }
  }
  const view = viewForEntry(entry)
  if (view) return { view, stack: [] }
  return { stack: [entry], view: baseViewForSeed(currentView) }
}
