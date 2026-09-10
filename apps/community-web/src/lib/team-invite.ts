export const TEAM_INVITE_TOKEN_PARAM = "teamInvite"

export const TEAM_INVITE_STASH_KEY = "civfix:event-team-invite"

export interface EventTeamInviteLink {
  cleanupId: string
  token: string
}

const CLEANUP_ID_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

function cleanupIdFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter((part) => part.length > 0)
  if (parts[0] !== "cleanups") return null
  const id = parts[1]
  if (id === undefined || id === "_" || !CLEANUP_ID_SEGMENT.test(id)) return null
  return id
}

function body(value: string, mark: "?" | "#"): string {
  return value.startsWith(mark) ? value.slice(1) : value
}

function tokenFromParams(params: string): string | null {
  const raw = new URLSearchParams(params).get(TEAM_INVITE_TOKEN_PARAM)
  const token = raw?.trim() ?? ""
  return token === "" ? null : token
}

export function teamInviteFromUrl(pathname: string, hash: string): EventTeamInviteLink | null {
  const cleanupId = cleanupIdFromPath(pathname)
  if (cleanupId === null) return null
  const token = tokenFromParams(body(hash, "#"))
  return token === null ? null : { cleanupId, token }
}

function withoutToken(params: string): string {
  const next = new URLSearchParams(params)
  next.delete(TEAM_INVITE_TOKEN_PARAM)
  return next.toString()
}

export function stripTeamInviteFromUrl(): void {
  if (typeof window === "undefined") return
  const { pathname, search, hash } = window.location
  const searchBody = body(search, "?")
  const hashBody = body(hash, "#")
  const inSearch = tokenFromParams(searchBody) !== null
  const inHash = tokenFromParams(hashBody) !== null
  if (!inSearch && !inHash) return
  const nextSearch = inSearch ? withoutToken(searchBody) : searchBody
  const nextHash = inHash ? withoutToken(hashBody) : hashBody
  const url = `${pathname}${nextSearch === "" ? "" : `?${nextSearch}`}${nextHash === "" ? "" : `#${nextHash}`}`
  window.history.replaceState(window.history.state, "", url)
}

export function takeTeamInviteFromUrl(): EventTeamInviteLink | null {
  if (typeof window === "undefined") return null
  const { pathname, hash } = window.location
  const link = teamInviteFromUrl(pathname, hash)
  stripTeamInviteFromUrl()
  return link
}

export const TEAM_INVITE_STASH_TTL_MS = 60 * 60_000

export function stashTeamInvite(link: EventTeamInviteLink): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(
      TEAM_INVITE_STASH_KEY,
      JSON.stringify({ ...link, stashedAt: Date.now() }),
    )
  } catch {
    return
  }
}

export function readStashedTeamInvite(): EventTeamInviteLink | null {
  if (typeof window === "undefined") return null
  let raw: string | null
  try {
    raw = window.sessionStorage.getItem(TEAM_INVITE_STASH_KEY)
  } catch {
    return null
  }
  if (raw === null) return null
  const link = parseStashedTeamInvite(raw, Date.now())
  if (link === null) clearStashedTeamInvite()
  return link
}

export function parseStashedTeamInvite(raw: string, now: number): EventTeamInviteLink | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== "object" || parsed === null) return null
  const { cleanupId, token, stashedAt } = parsed as Record<string, unknown>
  if (typeof cleanupId !== "string" || typeof token !== "string") return null
  if (cleanupId.trim() === "" || token.trim() === "") return null
  if (typeof stashedAt !== "number" || !Number.isFinite(stashedAt)) return null
  if (now < stashedAt || now - stashedAt > TEAM_INVITE_STASH_TTL_MS) return null
  return { cleanupId, token }
}

export function clearStashedTeamInvite(): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(TEAM_INVITE_STASH_KEY)
  } catch {
    return
  }
}
