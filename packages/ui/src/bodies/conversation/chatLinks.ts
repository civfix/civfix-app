import { entryFromPath } from "../../nav/routes"
import { WEB_ORIGIN } from "../../primitives/externalUrls"
import { mentionScanRegex, normalizeHandle } from "./mentionMatch"

export type ChatLinkTarget =
  | { kind: "internal"; path: string; url: string }
  | { kind: "external"; url: string }

export type ChatBodyToken =
  | { kind: "text"; text: string }
  | { kind: "mention"; text: string; handle: string; userId: string | null }
  | { kind: "link"; text: string; target: ChatLinkTarget }

export interface TokenizeChatBodyOptions {
  mentions?: ReadonlyMap<string, string | null>
  origins?: readonly string[]
}

const HTTPS_URL_SCAN = /https:\/\/[^\s]+/gi
const HTTPS_ORIGIN = /^https:\/\/([^/?#]*)/i
const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$/

const TRAILING_NOISE = new Set([".", ",", ";", ":", "!", "?", "'", '"', "“", "”", "‘", "’", "…", "*", "_", "~", "<", ">"])
const CLOSERS: Record<string, string> = { ")": "(", "]": "[", "}": "{" }

const HTTPS_DEFAULT_PORT = ":443"

interface ParsedHttpsUrl {
  origin: string
  path: string
}

function occurrences(text: string, ch: string): number {
  let n = 0
  for (let i = 0; i < text.length; i += 1) if (text[i] === ch) n += 1
  return n
}

export function trimUrlPunctuation(raw: string): string {
  let end = raw.length
  while (end > 0) {
    const ch = raw[end - 1] as string
    if (TRAILING_NOISE.has(ch)) {
      end -= 1
      continue
    }
    const opener = CLOSERS[ch]
    if (opener !== undefined) {
      const slice = raw.slice(0, end)
      if (occurrences(slice, ch) > occurrences(slice, opener)) {
        end -= 1
        continue
      }
    }
    break
  }
  return raw.slice(0, end)
}

export function parseHttpsUrl(url: string): ParsedHttpsUrl | null {
  const match = HTTPS_ORIGIN.exec(url)
  if (!match) return null
  const rawAuthority = match[1] as string
  if (rawAuthority.length === 0 || rawAuthority.includes("@")) return null
  const authority = rawAuthority.toLowerCase()
  if (!HOST.test(authority)) return null
  const host = authority.endsWith(HTTPS_DEFAULT_PORT)
    ? authority.slice(0, -HTTPS_DEFAULT_PORT.length)
    : authority
  if (host.length === 0) return null
  const rest = url.slice((match[0] as string).length)
  return { origin: `https://${host}`, path: rest.length > 0 ? rest : "/" }
}

export function normalizeLinkOrigin(origin: string): string | null {
  return parseHttpsUrl(origin)?.origin ?? null
}

let cachedAppOrigins: readonly string[] | null = null

export function appLinkOrigins(): readonly string[] {
  if (cachedAppOrigins !== null) return cachedAppOrigins
  const origins: string[] = []
  const canonical = normalizeLinkOrigin(WEB_ORIGIN)
  if (canonical !== null) origins.push(canonical)
  const location = (globalThis as { location?: { origin?: unknown } }).location
  const here = typeof location?.origin === "string" ? normalizeLinkOrigin(location.origin) : null
  if (here !== null && !origins.includes(here)) origins.push(here)
  cachedAppOrigins = origins
  return origins
}

export function resolveChatLinkTarget(url: string, origins: readonly string[]): ChatLinkTarget {
  const parsed = parseHttpsUrl(url)
  if (parsed === null) return { kind: "external", url }
  const allowed = origins.some((candidate) => normalizeLinkOrigin(candidate) === parsed.origin)
  if (!allowed) return { kind: "external", url }
  if (entryFromPath(parsed.path) === null) return { kind: "external", url }
  return { kind: "internal", path: parsed.path, url }
}

export function mentionLookup(
  mentions: readonly { id: string; handle: string }[] | undefined,
  cityHandle?: string | null,
): Map<string, string | null> {
  const byHandle = new Map<string, string | null>()
  if (cityHandle) {
    const city = normalizeHandle(cityHandle)
    if (city.length > 0) byHandle.set(city, null)
  }
  for (const mention of mentions ?? []) {
    const handle = normalizeHandle(mention.handle)
    if (handle.length > 0 && !byHandle.has(handle)) byHandle.set(handle, mention.id)
  }
  return byHandle
}

interface Span {
  start: number
  end: number
  token: ChatBodyToken
}

function linkSpans(body: string, origins: readonly string[]): Span[] {
  const spans: Span[] = []
  const re = new RegExp(HTTPS_URL_SCAN.source, HTTPS_URL_SCAN.flags)
  let match: RegExpExecArray | null
  while ((match = re.exec(body)) !== null) {
    const raw = match[0]
    const text = trimUrlPunctuation(raw)
    if (parseHttpsUrl(text) === null) continue
    spans.push({
      start: match.index,
      end: match.index + text.length,
      token: { kind: "link", text, target: resolveChatLinkTarget(text, origins) },
    })
  }
  return spans
}

function mentionSpans(body: string, mentions: ReadonlyMap<string, string | null>): Span[] {
  if (mentions.size === 0) return []
  const re = mentionScanRegex([...mentions.keys()])
  const spans: Span[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(body)) !== null) {
    const start = match.index + (match[1] ?? "").length
    const handle = match[2] as string
    spans.push({
      start,
      end: re.lastIndex,
      token: { kind: "mention", text: `@${handle}`, handle, userId: mentions.get(handle) ?? null },
    })
  }
  return spans
}

export function tokenizeChatBody(body: string, options: TokenizeChatBodyOptions = {}): ChatBodyToken[] {
  const origins = options.origins ?? []
  const links = linkSpans(body, origins)
  const mentions = mentionSpans(body, options.mentions ?? new Map()).filter(
    (span) => !links.some((link) => span.start < link.end && link.start < span.end),
  )
  const spans = [...links, ...mentions].sort((a, b) => a.start - b.start)
  const out: ChatBodyToken[] = []
  let cursor = 0
  for (const span of spans) {
    if (span.start > cursor) out.push({ kind: "text", text: body.slice(cursor, span.start) })
    out.push(span.token)
    cursor = span.end
  }
  if (cursor < body.length) out.push({ kind: "text", text: body.slice(cursor) })
  if (out.length === 0) out.push({ kind: "text", text: body })
  return out
}
