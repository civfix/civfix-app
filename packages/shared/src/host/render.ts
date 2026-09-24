import { httpsUrlAuthority, hostOfAuthority, unsafeHostReason } from "../markdown/safe-url.js"
import { collapseWhitespace, graphemeLength, truncateGraphemes } from "./graphemes.js"
import { intOr } from "../internal/numbers.js"

export const BROADCAST_VARS = [
  "first_name",
  "event_title",
  "event_when",
  "event_where",
  "ticket_type",
  "manage_link",
] as const

export type BroadcastVar = (typeof BROADCAST_VARS)[number]

export type BroadcastVarValues = Partial<Record<BroadcastVar, string>>

export const PUSH_TITLE_MAX = 40
export const PUSH_BODY_MAX = 140
export const INAPP_BODY_MAX = 200
export const SMS_BODY_MAX = 160
export const SMS_OPT_OUT_SUFFIX = "Reply STOP to opt out."
export const MAX_BROADCAST_LINKS = 5

const VAR_PATTERN = /\{([a-z][a-z0-9_]*)\}/g
const BROADCAST_VAR_SET: ReadonlySet<string> = new Set<string>(BROADCAST_VARS)

export function isBroadcastVar(name: string): name is BroadcastVar {
  return BROADCAST_VAR_SET.has(name)
}

export function renderBroadcastVars(template: string, values: BroadcastVarValues): string {
  return template.replace(VAR_PATTERN, (match, name: string) => {
    if (!isBroadcastVar(name)) return match
    return values[name] ?? ""
  })
}

export function pushTitleFrom(text: string): string {
  return truncateGraphemes(collapseWhitespace(text), PUSH_TITLE_MAX)
}

export function pushBodyFrom(text: string): string {
  return truncateGraphemes(collapseWhitespace(text), PUSH_BODY_MAX)
}

export function inAppBodyFrom(text: string): string {
  return truncateGraphemes(collapseWhitespace(text), INAPP_BODY_MAX)
}

export interface SmsBodyOptions {
  includeOptOut?: boolean
}

export function smsBodyFrom(text: string, options: SmsBodyOptions = {}): string {
  const body = collapseWhitespace(text)
  if (options.includeOptOut === false) return truncateGraphemes(body, SMS_BODY_MAX)
  const budget = SMS_BODY_MAX - graphemeLength(SMS_OPT_OUT_SUFFIX) - 1
  const head = truncateGraphemes(body, budget)
  return head.length === 0 ? SMS_OPT_OUT_SUFFIX : `${head} ${SMS_OPT_OUT_SUFFIX}`
}

export type BroadcastLinkIssue =
  | { kind: "too_many"; count: number; max: number }
  | { kind: "insecure_scheme"; url: string; scheme: string }
  | { kind: "scheme_relative"; url: string }
  | { kind: "userinfo"; url: string }
  | { kind: "ip_literal"; url: string; host: string }
  | { kind: "punycode"; url: string; host: string }
  | { kind: "non_ascii_host"; url: string; host: string }
  | { kind: "host_not_allowed"; url: string; host: string }

export class BroadcastLinkError extends Error {
  readonly issues: readonly BroadcastLinkIssue[]

  constructor(issues: readonly BroadcastLinkIssue[]) {
    super(`broadcast body contains unsafe links: ${issues.map((i) => i.kind).join(", ")}`)
    this.name = "BroadcastLinkError"
    this.issues = issues
  }
}

export interface BroadcastLinkOptions {
  allowedHosts?: readonly string[]
  maxLinks?: number
}

const ABSOLUTE_URL = /\b([a-zA-Z][a-zA-Z0-9+.-]*):\/\/[^\s<>"'`)\]}]+/g
const SCHEME_RELATIVE = /(^|[\s(<[{])(\/\/[^\s<>"'`)\]}]+)/g
const DANGEROUS_SCHEME = /\b(javascript|data|vbscript|file|blob|jar|about):/gi

function hostAllowed(host: string, allowed: readonly string[]): boolean {
  return allowed.some((entry) => {
    const candidate = entry.trim().toLowerCase().replace(/^\./, "")
    if (candidate.length === 0) return false
    return host === candidate || host.endsWith(`.${candidate}`)
  })
}

export function inspectBroadcastLinks(
  text: string,
  options: BroadcastLinkOptions = {},
): BroadcastLinkIssue[] {
  const issues: BroadcastLinkIssue[] = []
  const maxLinks = intOr(options.maxLinks, 0, MAX_BROADCAST_LINKS)
  const allowed = options.allowedHosts?.filter((entry) => entry.trim().length > 0) ?? []
  let count = 0

  for (const match of text.matchAll(DANGEROUS_SCHEME)) {
    const scheme = (match[1] ?? "").toLowerCase()
    issues.push({ kind: "insecure_scheme", url: match[0] ?? "", scheme })
  }

  for (const match of text.matchAll(SCHEME_RELATIVE)) {
    count++
    issues.push({ kind: "scheme_relative", url: match[2] ?? "" })
  }

  for (const match of text.matchAll(ABSOLUTE_URL)) {
    const url = match[0] ?? ""
    count++
    const scheme = (match[1] ?? "").toLowerCase()
    if (scheme !== "https") {
      issues.push({ kind: "insecure_scheme", url, scheme })
      continue
    }
    const authority = httpsUrlAuthority(url)
    if (authority.includes("@")) issues.push({ kind: "userinfo", url })
    const host = hostOfAuthority(authority)
    const reason = unsafeHostReason(host)
    if (reason !== null) {
      issues.push({ kind: reason, url, host })
      continue
    }
    if (allowed.length > 0 && !hostAllowed(host, allowed)) {
      issues.push({ kind: "host_not_allowed", url, host })
    }
  }

  if (count > maxLinks) issues.unshift({ kind: "too_many", count, max: maxLinks })
  return issues
}

export function assertSafeBroadcastLinks(text: string, options: BroadcastLinkOptions = {}): void {
  const issues = inspectBroadcastLinks(text, options)
  if (issues.length > 0) throw new BroadcastLinkError(issues)
}
