import { webOrigin } from "../../primitives/externalUrls"
import { parseHttpsUrl, type ChatBodyToken } from "./chatLinks"

export type CivfixLinkKind = "report" | "event" | "post" | "person" | "org"

export interface CivfixLinkRef {
  kind: CivfixLinkKind
  id: string
  path: string
  url: string
  key: string
}

export const CIVFIX_LINK_HOSTS: readonly string[] = [
  "civfix.org",
  "www.civfix.org",
  "civfix.dev",
  "www.civfix.dev",
]

export const CIVFIX_APP_SCHEME = "civfix"

export const MAX_EMBEDS_PER_MESSAGE = 2

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/

const APP_SCHEME_URL = /^civfix:\/\/(.*)$/i

function safeSegments(path: string): string[] | null {
  const withoutHash = path.split("#")[0] ?? ""
  const withoutQuery = withoutHash.split("?")[0] ?? ""
  const parts = withoutQuery.split("/").filter((part) => part.length > 0)
  for (const part of parts) if (!SAFE_SEGMENT.test(part)) return null
  return parts
}

function ref(kind: CivfixLinkKind, id: string, path: string, url: string): CivfixLinkRef {
  return { kind, id, path, url, key: `${kind}:${id}` }
}

export function civfixLinkFromPath(path: string, url: string = path): CivfixLinkRef | null {
  const parts = safeSegments(path)
  if (parts === null || parts.length < 2 || parts.length > 3) return null
  const [base, id, sub] = parts as [string, string, string | undefined]
  if (sub !== undefined && !(base === "post" && sub === "thread")) return null
  switch (base) {
    case "pin":
    case "reports":
      return ref("report", id, `/pin/${id}`, url)
    case "cleanups":
    case "e":
      return ref("event", id, `/cleanups/${id}`, url)
    case "post":
      return ref("post", id, `/post/${id}`, url)
    case "people":
      return ref("person", id, `/people/${id}`, url)
    case "orgs":
      return ref("org", id, `/orgs/${id}`, url)
    default:
      return null
  }
}

export function civfixEntityRef(kind: "report" | "event", id: string): CivfixLinkRef {
  const path = kind === "event" ? `/cleanups/${id}` : `/pin/${id}`
  return ref(kind, id, path, `${webOrigin()}${path}`)
}

function isCivfixLinkHost(origin: string): boolean {
  const host = origin.replace(/^https:\/\//i, "").toLowerCase()
  return CIVFIX_LINK_HOSTS.includes(host)
}

export function classifyCivfixUrl(url: string): CivfixLinkRef | null {
  const https = parseHttpsUrl(url)
  if (https !== null) {
    if (!isCivfixLinkHost(https.origin)) return null
    return civfixLinkFromPath(https.path, url)
  }
  const scheme = APP_SCHEME_URL.exec(url)
  if (scheme === null) return null
  return civfixLinkFromPath(`/${(scheme[1] as string).replace(/^\/+/, "")}`, url)
}

export interface ChatEmbedPlan {
  refs: CivfixLinkRef[]
  linkOnly: boolean
}

const NO_EMBEDS: ChatEmbedPlan = { refs: [], linkOnly: false }

const WHITESPACE_ONLY = /^\s*$/

const ATTACHED_TERMINATOR = /^[.,]\s*$/

export function planChatEmbeds(
  tokens: readonly ChatBodyToken[],
  limit: number = MAX_EMBEDS_PER_MESSAGE,
): ChatEmbedPlan {
  const refs: CivfixLinkRef[] = []
  const seen = new Set<string>()
  let embeddedLinks = 0
  let otherContent = false
  let afterLink = false
  for (const token of tokens) {
    if (token.kind === "text") {
      const spare = WHITESPACE_ONLY.test(token.text) || (afterLink && ATTACHED_TERMINATOR.test(token.text))
      if (!spare) otherContent = true
      afterLink = false
      continue
    }
    if (token.kind === "mention") {
      otherContent = true
      afterLink = false
      continue
    }
    afterLink = true
    const found = classifyCivfixUrl(token.text)
    if (found === null) {
      otherContent = true
      continue
    }
    embeddedLinks += 1
    if (seen.has(found.key) || refs.length >= limit) continue
    seen.add(found.key)
    refs.push(found)
  }
  if (refs.length === 0) return NO_EMBEDS
  return { refs, linkOnly: !otherContent && embeddedLinks === 1 }
}
