import type { DetailEntry, DetailKind, NavState, View } from "./types"

type NavMode = "compact" | "expanded"

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

export function isRootLink(path: string | null | undefined): boolean {
  return path === "/"
}

export function entryFromPath(path: string | null | undefined): DetailEntry | null {
  if (!path) return null
  const normalized = normalizePath(path)
  const routeView = viewFromPath(normalized)
  if (routeView === "map" || routeView === "search" || routeView === "report")
    return { kind: "view", view: routeView }
  const parts = normalized.split("/").filter((p) => p && p !== "_")
  if (parts.length === 0) return null
  const [base, id] = parts

  switch (base) {
    case "pin":
      return id ? { kind: "pin", id } : null
    case "cleanups": {
      if (!id) return { kind: "cleanups" }
      const sub = parts[2]
      if (sub === "edit") return { kind: "edit-cleanup", id }
      if (sub === "host") return { kind: "host-mode", id }
      if (sub === "checkin") return { kind: "host-checkin", id }
      if (sub === "announce") return { kind: "host-announce", id }
      if (sub === "team") return { kind: "host-team", id }
      if (sub === "hours") return { kind: "host-log-hours", id }
      if (sub === "analytics") return { kind: "event-analytics", id }
      if (sub === "announcements") {
        const announcementId = parts[3]
        return announcementId
          ? { kind: "announcement", id, announcementId }
          : { kind: "announcements", id }
      }
      if (sub === "ticket") {
        const seatId = parts[3]
        return seatId ? { kind: "my-ticket", id, seatId } : { kind: "my-ticket", id }
      }
      return { kind: "cleanup", id }
    }
    case "events":
      return { kind: "cleanups" }
    case "e":
      return id ? { kind: "cleanup", id } : null
    case "orgs":
      return id ? { kind: "org", slug: id } : null
    case "people":
      if (id && parts[2] === "followers") return { kind: "followers", id }
      if (id && parts[2] === "following") return { kind: "following", id }
      return id ? { kind: "person", id } : { kind: "people" }
    case "leaderboard":
      return id ? { kind: "leaderboard", geoid: id } : null
    case "messages":
      if (id === "pins") {
        const rk = parts[2]
        const roomId = parts[3]
        if (roomId && (rk === "dm" || rk === "report" || rk === "cleanup" || rk === "group")) {
          return { kind: "pinned-messages", id: roomId, roomKind: rk }
        }
        return { kind: "messages" }
      }
      if (id === "members") {
        const rk = parts[2]
        const roomId = parts[3]
        if (roomId && (rk === "dm" || rk === "report" || rk === "cleanup" || rk === "group")) {
          return { kind: "members", id: roomId, roomKind: rk }
        }
        return { kind: "messages" }
      }
      if (id === "dm") {
        const dmId = parts[2]
        return dmId ? { kind: "thread", id: dmId, roomKind: "dm" } : { kind: "messages" }
      }
      if (id === "report") {
        const reportRoomId = parts[2]
        return reportRoomId ? { kind: "thread", id: reportRoomId, roomKind: "report" } : { kind: "messages" }
      }
      if (id === "group") {
        const groupRoomId = parts[2]
        return groupRoomId ? { kind: "thread", id: groupRoomId, roomKind: "group" } : { kind: "messages" }
      }
      return id ? { kind: "thread", id, roomKind: "cleanup" } : { kind: "messages" }
    case "reports":
      return id ? { kind: "pin", id } : { kind: "myreports" }
    case "notifications":
      return id === "prefs" ? { kind: "notification-prefs" } : { kind: "activity" }
    case "profile":
      return { kind: "profile" }
    case "settings":
      if (!id) return { kind: "settings" }
      if (id === "account") return { kind: "settings-account" }
      if (id === "privacy") return { kind: "settings-privacy" }
      if (id === "blocked") return { kind: "blocked" }
      if (id === "language") return { kind: "language-settings" }
      if (id === "appearance") return { kind: "appearance-settings" }
      return null
    case "host":
      return { kind: "create-cleanup" }
    case "groups":
      if (id === "new") return { kind: "new-group" }
      if (id && parts[2] === "info") return { kind: "group-info", id }
      return null
    case "channels":
      if (id === "new") return { kind: "new-channel" }
      return null
    case "dashboard":
      return { kind: "event-dashboard" }
    case "post":
      if (id && parts[2] === "thread") return { kind: "post-thread", id }
      return id ? { kind: "post", id } : null
    case "compose":
      if (id === "quote" && parts[2]) {
        return { kind: "composer", composerMode: "quote", targetPostId: parts[2] }
      }
      return { kind: "composer" }
    case "saves":
      return { kind: "saves" }
    default:
      return null
  }
}

export function pathForEntry(entry: DetailEntry | null): string {
  if (!entry) return "/"
  if (entry.kind === "view") return entry.view ? pathForView(entry.view) ?? "/" : "/"
  switch (entry.kind) {
    case "pin":
      return entry.id ? `/pin/${entry.id}` : "/"
    case "cleanups":
      return "/cleanups"
    case "cleanup":
      return entry.id ? `/cleanups/${entry.id}` : "/cleanups"
    case "edit-cleanup":
      return entry.id ? `/cleanups/${entry.id}/edit` : "/cleanups"
    case "host-mode":
      return entry.id ? `/cleanups/${entry.id}/host` : "/cleanups"
    case "host-checkin":
      return entry.id ? `/cleanups/${entry.id}/checkin` : "/cleanups"
    case "host-announce":
      return entry.id ? `/cleanups/${entry.id}/announce` : "/cleanups"
    case "host-team":
      return entry.id ? `/cleanups/${entry.id}/team` : "/cleanups"
    case "host-log-hours":
      return entry.id ? `/cleanups/${entry.id}/hours` : "/cleanups"
    case "event-analytics":
      return entry.id ? `/cleanups/${entry.id}/analytics` : "/cleanups"
    case "announcements":
      return entry.id ? `/cleanups/${entry.id}/announcements` : "/cleanups"
    case "announcement":
      if (!entry.id) return "/cleanups"
      return entry.announcementId
        ? `/cleanups/${entry.id}/announcements/${entry.announcementId}`
        : `/cleanups/${entry.id}/announcements`
    case "my-ticket":
      if (!entry.id) return "/cleanups"
      return entry.seatId
        ? `/cleanups/${entry.id}/ticket/${entry.seatId}`
        : `/cleanups/${entry.id}/ticket`
    case "org":
      return entry.slug ? `/orgs/${entry.slug}` : "/"
    case "create-cleanup":
      return "/host"
    case "people":
      return "/people"
    case "person":
      return entry.id ? `/people/${entry.id}` : "/people"
    case "followers":
      return entry.id ? `/people/${entry.id}/followers` : "/people"
    case "following":
      return entry.id ? `/people/${entry.id}/following` : "/people"
    case "leaderboard":
      return entry.geoid ? `/leaderboard/${entry.geoid}` : "/"
    case "messages":
      return "/messages"
    case "thread":
      if (!entry.id) return "/messages"
      if (entry.roomKind === "dm") return `/messages/dm/${entry.id}`
      if (entry.roomKind === "report") return `/messages/report/${entry.id}`
      if (entry.roomKind === "group") return `/messages/group/${entry.id}`
      return `/messages/${entry.id}`
    case "pinned-messages":
      return entry.id ? `/messages/pins/${entry.roomKind ?? "cleanup"}/${entry.id}` : "/messages"
    case "members":
      return entry.id ? `/messages/members/${entry.roomKind ?? "cleanup"}/${entry.id}` : "/messages"
    case "myreports":
      return "/reports"
    case "activity":
      return "/notifications"
    case "notification-prefs":
      return "/notifications/prefs"
    case "profile":
      return "/profile"
    case "settings":
      return "/settings"
    case "settings-account":
      return "/settings/account"
    case "settings-privacy":
      return "/settings/privacy"
    case "blocked":
      return "/settings/blocked"
    case "language-settings":
      return "/settings/language"
    case "appearance-settings":
      return "/settings/appearance"
    case "event-dashboard":
      return "/dashboard"
    case "new-group":
      return "/groups/new"
    case "new-channel":
      return "/channels/new"
    case "group-info":
      return entry.id ? `/groups/${entry.id}/info` : "/messages"
    case "new-msg":
      return "/messages"
    case "post":
      return entry.id ? `/post/${entry.id}` : "/"
    case "post-thread":
      return entry.id ? `/post/${entry.id}/thread` : "/"
    case "composer":
      return entry.composerMode === "quote" && entry.targetPostId
        ? `/compose/quote/${entry.targetPostId}`
        : "/compose"
    case "saves":
      return "/saves"
    case "drop-pin":
      return "/map"
    default:
      return "/"
  }
}

export function pathForView(view: View): string | null {
  if (view === "map") return "/map"
  if (view === "search") return "/search"
  if (view === "report") return "/report"
  return null
}

export function viewFromPath(path: string | null | undefined): View | null {
  if (!path) return null
  const base = normalizePath(path)
    .split("/")
    .filter((p) => p && p !== "_")[0]
  if (base === "map") return "map"
  if (base === "search") return "search"
  if (base === "report") return "report"
  return null
}

export function titleForEntry(entry: DetailEntry | null): string {
  if (!entry) return ""
  switch (entry.kind) {
    case "view":
      return ""
    case "pin":
      return "title.pin"
    case "cleanups":
      return "title.cleanups"
    case "myreports":
      return "title.myreports"
    case "cleanup":
      return "title.cleanup"
    case "messages":
      return "title.messages"
    case "thread":
      return " "
    case "pinned-messages":
      return " "
    case "new-group":
    case "new-channel":
      return " "
    case "new-msg":
      return "title.new_msg"
    case "people":
      return "title.people"
    case "person":
      return " "
    case "followers":
      return "title.followers"
    case "following":
      return "title.following"
    case "leaderboard":
      return "title.leaderboard"
    case "activity":
      return "title.activity"
    case "notification-prefs":
      return "title.notification_prefs"
    case "profile":
      return "title.profile"
    case "settings":
      return "title.settings"
    case "settings-account":
      return "title.settings_account"
    case "settings-privacy":
      return "title.settings_privacy"
    case "blocked":
      return "title.blocked"
    case "language-settings":
      return "title.language_settings"
    case "appearance-settings":
      return "title.appearance_settings"
    case "create-cleanup":
      return "title.create_cleanup"
    case "edit-cleanup":
      return "title.edit_cleanup"
    case "host-mode":
      return "title.host_mode"
    case "host-checkin":
      return "title.host_checkin"
    case "host-announce":
      return "title.host_announce"
    case "host-team":
      return "title.host_team"
    case "host-log-hours":
      return "title.host_log_hours"
    case "event-analytics":
      return "title.event_analytics"
    case "announcements":
      return "title.announcements"
    case "announcement":
      return "title.announcement"
    case "my-ticket":
      return "title.my_ticket"
    case "org":
      return "title.org"
    case "event-dashboard":
      return "title.event_dashboard"
    case "cluster":
      return "title.cluster"
    case "blend":
      return entry.event?.title || "title.cleanup"
    case "members":
      return entry.roomKind === "report" || entry.roomKind === "cleanup"
        ? "title.chat_info"
        : "title.members"
    case "group-info":
      return "title.group_info"
    case "post":
      return "title.post"
    case "saves":
      return "title.saves"
    case "drop-pin":
      return "title.drop_pin"
    case "post-thread":
    case "composer":
      return " "
    default:
      return ""
  }
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
  switch (entry.kind) {
    case "view":
      return entry.view ?? null
    case "myreports":
      return "reports"
    case "cleanups":
      return "events"
    case "people":
      return "social"
    case "messages":
      return "messaging"
    default:
      return null
  }
}

export function parentViewForEntry(entry: DetailEntry | null): View | null {
  if (!entry) return null
  switch (entry.kind) {
    case "view":
      return null
    case "pin":
    case "myreports":
      return "reports"
    case "cleanup":
    case "cleanups":
    case "host-mode":
    case "host-checkin":
    case "host-announce":
    case "host-team":
    case "host-log-hours":
    case "my-ticket":
    case "announcement":
    case "announcements":
    case "event-analytics":
    case "org":
    case "event-dashboard":
      return "events"
    case "person":
    case "people":
      return "social"
    case "thread":
    case "messages":
    case "pinned-messages":
    case "new-group":
    case "new-channel":
    case "group-info":
      return "messaging"
    case "post":
    case "post-thread":
    case "saves":
      return "home"
    case "drop-pin":
      return "map"
    default:
      return null
  }
}

function baseViewForSeed(currentView: View): View {
  return currentView === "map" ? "home" : currentView
}

export function seedFor(
  entry: DetailEntry | null,
  _mode: NavMode,
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
