export const EVENT_SECTIONS = [
  "overview",
  "page",
  "tickets",
  "attendees",
  "checkin",
  "broadcasts",
  "analytics",
  "team",
  "settings",
] as const

export type EventSection = (typeof EVENT_SECTIONS)[number]

export const ORG_SECTIONS = [
  "overview",
  "events",
  "members",
  "verification",
  "settings",
  "payments",
] as const
export type OrgSection = (typeof ORG_SECTIONS)[number]

/** Org sections only an owner or admin may open; members see the rest. */
export const ORG_MANAGE_SECTIONS: readonly OrgSection[] = ["verification", "settings", "payments"]

/** The `/manage/orgs/<segment>` that is a verb, not an org id. */
const ORG_NEW_SEGMENT = "new"

/**
 * `/manage/org-invites/accept/?token=…` - the landing page an org invite email links to. It is not
 * under `/manage/orgs/<id>` because the token identifies the org (the accept endpoint is
 * `POST /org-invites/accept`, DECISIONS §32), so the page has no org id to route by.
 */
const ORG_INVITES_SEGMENT = "org-invites"
const ORG_INVITE_ACCEPT_SEGMENT = "accept"
export const ORG_INVITE_TOKEN_PARAM = "token"

export type ConsoleRoute =
  | { kind: "portfolio" }
  | { kind: "org-new" }
  | { kind: "org"; orgId: string; section: OrgSection }
  | { kind: "org-invite-accept"; token: string | null }
  | { kind: "event"; eventId: string; section: Exclude<EventSection, "broadcasts"> }
  | { kind: "broadcasts"; eventId: string }
  | { kind: "broadcast-new"; eventId: string }
  | { kind: "broadcast"; eventId: string; broadcastId: string }
  | { kind: "not-found"; path: string }

const CONSOLE_ROOT = "/manage"

const EVENT_SECTION_SET = new Set<string>(EVENT_SECTIONS)
const ORG_SECTION_SET = new Set<string>(ORG_SECTIONS)

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

function segments(pathname: string): string[] {
  const withoutRoot = pathname.startsWith(CONSOLE_ROOT)
    ? pathname.slice(CONSOLE_ROOT.length)
    : pathname
  return withoutRoot.split("/").filter((part) => part.length > 0)
}

function tokenFromParams(params: string): string | null {
  const raw = new URLSearchParams(params).get(ORG_INVITE_TOKEN_PARAM)
  const token = raw?.trim() ?? ""
  return token === "" ? null : token
}

/**
 * The invite email puts the token in the URL FRAGMENT (`#token=`), which browsers never send to the
 * server, so it stays out of access logs, referrers and link-preview fetchers (DECISIONS §32); a
 * `?token=` query is accepted too for a hand-typed or forwarded link. `query` is `search + hash`
 * as the browser exposes them (`?a=1#token=x`).
 */
function inviteTokenFromQuery(query: string): string | null {
  const hashAt = query.indexOf("#")
  const search = hashAt >= 0 ? query.slice(0, hashAt) : query
  const hash = hashAt >= 0 ? query.slice(hashAt + 1) : ""
  return tokenFromParams(hash) ?? tokenFromParams(search)
}

/** Whether `pathname` is the invite landing page - the one console route addressed by a parameter. */
export function isOrgInviteAcceptPath(pathname: string): boolean {
  const parts = segments(pathname)
  return parts.length === 2 && parts[0] === ORG_INVITES_SEGMENT && parts[1] === ORG_INVITE_ACCEPT_SEGMENT
}

/**
 * The invite token `query` (`search + hash`) carries, but only on the accept path: every other
 * console route ignores the query entirely, so a caller can key on this value instead of the raw
 * query string and stay stable while tab / search / drawer params churn.
 */
export function inviteTokenForPath(pathname: string, query: string): string | null {
  return isOrgInviteAcceptPath(pathname) ? inviteTokenFromQuery(query) : null
}

/** The `query` that puts `token` back into a parse - the fragment form the emailed link uses. */
export function inviteTokenQuery(token: string | null): string {
  return token === null ? "" : `#${ORG_INVITE_TOKEN_PARAM}=${encodeURIComponent(token)}`
}

/**
 * `query` carries `location.search + location.hash` for the routes that are addressed by one (the
 * invite token). When it is omitted and `pathname` itself contains a `?` or `#`, the two are split
 * apart, so an `hrefForRoute` output round-trips through this function unchanged.
 */
export function parseConsoleRoute(pathname: string, query?: string): ConsoleRoute {
  let path = pathname
  let params = query ?? ""
  if (query === undefined) {
    const mark = pathname.search(/[?#]/)
    if (mark >= 0) {
      path = pathname.slice(0, mark)
      params = pathname.slice(mark)
    }
  }
  const parts = segments(path)
  if (parts.length === 0) return { kind: "portfolio" }
  if (parts.length === 1 && parts[0] === "_") return { kind: "portfolio" }

  const [head, id, third, fourth] = parts

  if (head === ORG_INVITES_SEGMENT) {
    if (parts.length === 2 && id === ORG_INVITE_ACCEPT_SEGMENT) {
      return { kind: "org-invite-accept", token: inviteTokenFromQuery(params) }
    }
    return { kind: "not-found", path: pathname }
  }

  if (head === "orgs") {
    if (id === undefined || !SEGMENT.test(id)) return { kind: "not-found", path: pathname }
    if (id === ORG_NEW_SEGMENT) {
      return parts.length === 2 ? { kind: "org-new" } : { kind: "not-found", path: pathname }
    }
    if (third === undefined) return { kind: "org", orgId: id, section: "overview" }
    if (parts.length === 3 && ORG_SECTION_SET.has(third)) {
      return { kind: "org", orgId: id, section: third as OrgSection }
    }
    return { kind: "not-found", path: pathname }
  }

  if (head === "events") {
    if (id === undefined || !SEGMENT.test(id)) return { kind: "not-found", path: pathname }
    if (third === undefined) return { kind: "event", eventId: id, section: "overview" }

    if (third === "broadcasts") {
      if (parts.length === 3) return { kind: "broadcasts", eventId: id }
      if (parts.length === 4 && fourth === "new") return { kind: "broadcast-new", eventId: id }
      if (parts.length === 4 && fourth !== undefined && SEGMENT.test(fourth)) {
        return { kind: "broadcast", eventId: id, broadcastId: fourth }
      }
      return { kind: "not-found", path: pathname }
    }

    if (parts.length === 3 && EVENT_SECTION_SET.has(third)) {
      return {
        kind: "event",
        eventId: id,
        section: third as Exclude<EventSection, "broadcasts">,
      }
    }
    return { kind: "not-found", path: pathname }
  }

  return { kind: "not-found", path: pathname }
}

export function hrefForRoute(route: ConsoleRoute): string {
  switch (route.kind) {
    case "portfolio":
      return `${CONSOLE_ROOT}/`
    case "org-new":
      return `${CONSOLE_ROOT}/orgs/${ORG_NEW_SEGMENT}/`
    case "org":
      return route.section === "overview"
        ? `${CONSOLE_ROOT}/orgs/${route.orgId}/`
        : `${CONSOLE_ROOT}/orgs/${route.orgId}/${route.section}/`
    case "org-invite-accept": {
      const base = `${CONSOLE_ROOT}/${ORG_INVITES_SEGMENT}/${ORG_INVITE_ACCEPT_SEGMENT}/`
      // Fragment, like the emailed link: the token never reaches a server.
      return `${base}${inviteTokenQuery(route.token)}`
    }
    case "event":
      return route.section === "overview"
        ? `${CONSOLE_ROOT}/events/${route.eventId}/`
        : `${CONSOLE_ROOT}/events/${route.eventId}/${route.section}/`
    case "broadcasts":
      return `${CONSOLE_ROOT}/events/${route.eventId}/broadcasts/`
    case "broadcast-new":
      return `${CONSOLE_ROOT}/events/${route.eventId}/broadcasts/new/`
    case "broadcast":
      return `${CONSOLE_ROOT}/events/${route.eventId}/broadcasts/${route.broadcastId}/`
    case "not-found":
      return `${CONSOLE_ROOT}/`
  }
}

export function eventIdForRoute(route: ConsoleRoute): string | null {
  switch (route.kind) {
    case "event":
    case "broadcasts":
    case "broadcast-new":
    case "broadcast":
      return route.eventId
    default:
      return null
  }
}

export function railSectionForRoute(route: ConsoleRoute): EventSection | null {
  switch (route.kind) {
    case "event":
      return route.section
    case "broadcasts":
    case "broadcast-new":
    case "broadcast":
      return "broadcasts"
    default:
      return null
  }
}
