export type IncomingLink =
  | { type: "internal"; path: string }
  | { type: "external"; url: string }
  | { type: "home" }

export const WEB_ORIGIN = "https://civfix.org"

const WEB_HOSTS = new Set(["civfix.org", "www.civfix.org"])

const APP_SCHEMES = new Set(["civfix", "exp", "exp+civfix-community", "org.civfix.community"])

const DEV_CLIENT_SEGMENT = "expo-development-client"

const BROWSER_ONLY_ROOTS = new Set([
  "guest",
  "claim",
  "service-record",
  "legal",
  ".well-known",
  "landscape",
  "skeleton",
  "bodies",
  "manage",
  "unsubscribe",
])

const SETTINGS_CHILDREN = new Set(["account", "privacy", "blocked", "language"])

const ROOM_KINDS = new Set(["dm", "report", "cleanup", "group"])

const WEB_URL = /^https:\/\/([^/?#]+)([/?#].*)?$/i

const SCHEME = /^([a-z][a-z0-9+.-]*):/i

export interface ResolveOptions {
  isDev?: boolean
}

export function resolveIncomingPath(raw: unknown, { isDev = false }: ResolveOptions = {}): IncomingLink {
  if (typeof raw !== "string" || raw === "") return { type: "home" }

  const web = WEB_URL.exec(raw)
  if (web) {
    if (!isWebHost(web[1])) return { type: "home" }
    return fromPath(web[2] ?? "/", raw)
  }

  const scheme = SCHEME.exec(raw)
  if (scheme) {
    if (!APP_SCHEMES.has(scheme[1].toLowerCase())) return { type: "home" }
    return fromAppSchemeUrl(raw, scheme[1].toLowerCase(), raw.slice(scheme[0].length), isDev)
  }

  if (!raw.startsWith("/") || raw.startsWith("//")) return { type: "home" }
  return fromPath(raw, null)
}

function isWebHost(authority: string): boolean {
  const host = authority.toLowerCase()
  return WEB_HOSTS.has(host.endsWith(":443") ? host.slice(0, -":443".length) : host)
}

/**
 * Query parameters an outside link may hand each route. Anything else is dropped, because route
 * screens trust their params as in-app state: `/messages/<id>` would otherwise take `peerId` /
 * `peerName` from a link (a spoofed DM header and Block target), `/compose` a reply/quote target, and
 * a `teamInvite` token would leak into route params. The in-app bridge pushes those params directly
 * through the router and never comes through here.
 */
const ATTRIBUTION_QUERY: ReadonlySet<string> = new Set(["from"])
const REPORTS_QUERY: ReadonlySet<string> = new Set(["from", "tab"])
const ROOM_THREAD_QUERY: ReadonlySet<string> = new Set(["from", "roomKind"])

const ROOM_THREAD_PATH = /^\/messages\/[^/]+$/

function allowedQueryFor(path: string): ReadonlySet<string> {
  if (path === "/reports") return REPORTS_QUERY
  if (ROOM_THREAD_PATH.test(path)) return ROOM_THREAD_QUERY
  return ATTRIBUTION_QUERY
}

function decodeParamName(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "))
  } catch {
    return raw
  }
}

function internalQuery(path: string, query: string): string {
  if (query === "") return ""
  const allowed = allowedQueryFor(path)
  const kept = query
    .slice(1)
    .split("&")
    .filter((pair) => pair !== "" && allowed.has(decodeParamName(pair.split("=")[0] ?? "")))
  return kept.length === 0 ? "" : `?${kept.join("&")}`
}

function splitPath(raw: string): { parts: string[]; query: string } {
  const hashAt = raw.indexOf("#")
  const withoutHash = hashAt === -1 ? raw : raw.slice(0, hashAt)
  const queryAt = withoutHash.indexOf("?")
  const query = queryAt === -1 ? "" : withoutHash.slice(queryAt)
  const pathname = queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt)
  return { parts: pathname.split("/").filter((part) => part !== ""), query }
}

function fromPath(raw: string, originalUrl: string | null): IncomingLink {
  const { parts, query } = splitPath(raw)

  if (BROWSER_ONLY_ROOTS.has(parts[0] ?? "")) {
    return { type: "external", url: originalUrl ?? `${WEB_ORIGIN}/${parts.join("/")}${query}` }
  }

  const path = internalPathFor(parts)
  if (path === null || path === "/") return { type: "home" }
  return { type: "internal", path: `${path}${internalQuery(path, query)}` }
}

/**
 * Default-deny: any other app on the device can open a scheme URL, so only paths in the route table
 * reach the router. Dev-client launcher and Metro (`exp://`) URLs pass through verbatim in dev builds
 * only; a release build has no dev client to receive them.
 */
function fromAppSchemeUrl(raw: string, scheme: string, afterScheme: string, isDev: boolean): IncomingLink {
  const body = afterScheme.startsWith("//") ? afterScheme.slice(2) : afterScheme
  const { parts, query } = splitPath(body)

  if (parts[0] === DEV_CLIENT_SEGMENT) return isDev ? { type: "internal", path: raw } : { type: "home" }
  if (BROWSER_ONLY_ROOTS.has(parts[0] ?? "")) return { type: "home" }

  const path = internalPathFor(parts)
  if (path === null) return isDev && scheme === "exp" ? { type: "internal", path: raw } : { type: "home" }
  if (path === "/") return { type: "home" }
  return { type: "internal", path: `${path}${internalQuery(path, query)}` }
}

function internalPathFor(parts: readonly string[]): string | null {
  const [base, a, b, c] = parts

  switch (base) {
    case undefined:
      return "/"
    case "map":
    case "search":
    case "about":
    case "profile":
    case "dashboard":
    case "discover":
    case "saves":
    case "report":
      return a ? null : `/${base}`
    case "compose":
      return "/compose"
    case "host":
    case "host-event":
      return "/host-event"
    case "events":
      return a ? `/cleanups/${a}` : "/cleanups"
    case "e":
      return a ? `/cleanups/${a}` : null
    case "orgs":
      return a ? `/orgs/${a}` : null
    case "cleanups":
      if (!a) return "/cleanups"
      return cleanupPathFor(a, b, c)
    case "reports":
      return a ? `/pin/${a}` : "/reports"
    case "pin":
      return a ? `/pin/${a}` : null
    case "people":
      return a ? `/people/${a}` : "/people"
    case "leaderboard":
      return a ? `/leaderboard/${a}` : null
    case "post":
      return a ? `/post/${a}` : null
    case "notifications":
      if (!a) return "/notifications"
      return a === "prefs" ? "/notifications/prefs" : null
    case "settings":
      if (!a) return "/settings"
      return SETTINGS_CHILDREN.has(a) ? `/settings/${a}` : null
    case "groups":
      if (a === "new") return "/messages"
      return a && b === "info" ? `/groups/${a}/info` : null
    case "channels":
      return a === "new" ? "/messages" : null
    case "messages":
      return messagesPathFor(a, b, c)
    default:
      return null
  }
}

const CLEANUP_CHILDREN = new Set(["edit", "host", "checkin", "team", "hours"])

function cleanupPathFor(
  id: string,
  sub: string | undefined,
  seatId: string | undefined,
): string {
  if (!sub) return `/cleanups/${id}`
  if (CLEANUP_CHILDREN.has(sub)) return `/cleanups/${id}/${sub}`
  if (sub === "ticket") {
    return seatId ? `/cleanups/${id}/ticket/${seatId}` : `/cleanups/${id}/ticket`
  }
  return `/cleanups/${id}`
}

function messagesPathFor(
  a: string | undefined,
  b: string | undefined,
  c: string | undefined,
): string | null {
  if (!a) return "/messages"
  if (a === "dm" || a === "report" || a === "group") return b ? `/messages/${a}/${b}` : "/messages"
  if (a === "members") return b && c && ROOM_KINDS.has(b) ? `/messages/members/${b}/${c}` : "/messages"
  if (a === "pins") return b && c && ROOM_KINDS.has(b) ? threadPathFor(b, c) : "/messages"
  return b ? null : `/messages/${a}`
}

function threadPathFor(roomKind: string, id: string): string {
  return roomKind === "cleanup" ? `/messages/${id}` : `/messages/${roomKind}/${id}`
}
