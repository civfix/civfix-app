import { PERVASIVE_HEADERS } from "../src/lib/edge-headers"
import {
  PRODUCTION_SITE_URL,
  STAGING_HOSTNAMES,
  resolveSiteOrigin,
} from "../src/lib/site-meta"
import {
  defaultPreview,
  withNoindex,
  previewForEvent,
  previewForOrganization,
  previewForPerson,
  previewForReport,
  previewForSignupPage,
  type EventPreviewInput,
  type LinkPreview,
  type OrganizationPreviewInput,
  type PersonPreviewInput,
  type PreviewContext,
  type PreviewKind,
  type ReportPreviewInput,
  type SignupPagePreviewInput,
} from "../src/lib/link-preview"

interface AssetFetcher {
  fetch(input: Request | string | URL): Promise<Response>
}

export interface PreviewEnv {
  ASSETS: AssetFetcher
  CIVFIX_API_URL?: string
}

export interface PreviewContextArg {
  request: Request
  env: PreviewEnv
  params: Record<string, string | string[] | undefined>
  waitUntil?: (promise: Promise<unknown>) => void
}

export interface PreviewDeps {
  rewrite(shell: Response, preview: LinkPreview): Response
}

export const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
export const API_TIMEOUT_MS = 1500
export const PREVIEW_CACHE_TTL_SEC = 300
export const PREVIEW_NEGATIVE_CACHE_TTL_SEC = 60
export const NEGATIVE_CACHE_HEADER = "x-civfix-preview-miss"
export const CACHE_KEY_ORIGIN = "https://link-preview.civfix.internal"

export const PROD_API = "https://api.civfix.org"
export const STAGING_API = "https://api.civfix.dev"

const ALLOWED_API_HOSTNAMES: readonly string[] = ["api.civfix.org", "api.civfix.dev"]

export const HTML_CONTENT_TYPE = "text/html; charset=utf-8"

export const SHELL_PATH: Record<PreviewKind, string> = {
  report: "/pin/_/",
  event: "/cleanups/_/",
  person: "/people/_/",
  signup: "/e/_/",
  org: "/orgs/_/",
}

export const BROWSE_PATH: Record<PreviewKind, string> = {
  report: "/pin/_/",
  event: "/__spa/cleanups/",
  person: "/__spa/people/",
  signup: "/e/_/",
  org: "/orgs/_/",
}

export const CANONICAL_PREFIX: Record<PreviewKind, string> = {
  report: "/pin/",
  event: "/cleanups/",
  person: "/people/",
  signup: "/e/",
  org: "/orgs/",
}

export const API_PREFIX: Record<PreviewKind, string> = {
  report: "/v1/reports/",
  event: "/v1/cleanups/",
  person: "/v1/people/",
  signup: "/v1/pages/",
  org: "/v1/orgs/by-slug/",
}

export type PreviewOutcome = "found" | "missing" | "transient"

export type PreviewRoute =
  | { action: "passthrough" }
  | { action: "browse" }
  | { action: "shell" }
  | { action: "preview"; id: string }

export function isValidPreviewId(id: string): boolean {
  return ID_PATTERN.test(id)
}

export function parsePreviewRoute(
  method: string,
  raw: string | string[] | undefined,
): PreviewRoute {
  if (method.toUpperCase() !== "GET") return { action: "passthrough" }
  const segments = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter((part) => part.length > 0)
  if (segments.length === 0) return { action: "browse" }
  const id = segments[0] as string
  if (segments.length > 1 || !isValidPreviewId(id)) return { action: "shell" }
  return { action: "preview", id }
}

export function apiBaseFor(requestUrl: string, env: PreviewEnv): string {
  const override = env.CIVFIX_API_URL?.trim()
  if (override) {
    let parsed: URL | null = null
    try {
      parsed = new URL(override)
    } catch {
      parsed = null
    }
    if (parsed && parsed.protocol === "https:" && ALLOWED_API_HOSTNAMES.includes(parsed.hostname)) {
      return parsed.origin
    }
  }
  let host = ""
  try {
    host = new URL(requestUrl).hostname
  } catch {
    host = ""
  }
  return STAGING_HOSTNAMES.includes(host) ? STAGING_API : PROD_API
}

export function buildUpstreamRequest(kind: PreviewKind, id: string, base: string): Request {
  return new Request(`${base}${API_PREFIX[kind]}${encodeURIComponent(id)}`, {
    method: "GET",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  })
}

export function shouldFallback(status: number): boolean {
  return status < 200 || status > 299
}

export function previewCacheKey(kind: PreviewKind, id: string, apiHost: string): string {
  return `${CACHE_KEY_ORIGIN}/${encodeURIComponent(apiHost)}/${kind}/${encodeURIComponent(id)}`
}

export function apiHostOf(apiBase: string): string {
  try {
    return new URL(apiBase).hostname
  } catch {
    return apiBase
  }
}

export function upstreamOutcome(status: number): PreviewOutcome {
  if (!shouldFallback(status)) return "found"
  return status === 404 || status === 410 ? "missing" : "transient"
}

export function shouldNoindex(origin: string, outcome: PreviewOutcome): boolean {
  return outcome === "missing" || origin !== PRODUCTION_SITE_URL
}

export function cacheTtlSeconds(found: boolean): number {
  return found ? PREVIEW_CACHE_TTL_SEC : PREVIEW_NEGATIVE_CACHE_TTL_SEC
}

export function cacheablePayloadResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${PREVIEW_CACHE_TTL_SEC}`,
    },
  })
}

export function negativeCacheResponse(outcome: "missing" | "transient"): Response {
  return new Response("", {
    status: 200,
    headers: {
      [NEGATIVE_CACHE_HEADER]: outcome,
      "Cache-Control": `public, max-age=${PREVIEW_NEGATIVE_CACHE_TTL_SEC}`,
    },
  })
}

export function negativeCacheOutcome(response: Response): "missing" | "transient" | null {
  const value = response.headers.get(NEGATIVE_CACHE_HEADER)
  return value === "missing" || value === "transient" ? value : null
}

export function isNegativeCacheEntry(response: Response): boolean {
  return negativeCacheOutcome(response) !== null
}

export function withPervasiveHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(PERVASIVE_HEADERS)) headers.set(key, value)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export function htmlResponse(response: Response): Response {
  const shaped = withPervasiveHeaders(response)
  shaped.headers.set("Content-Type", HTML_CONTENT_TYPE)
  return shaped
}

export interface EdgeCache {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}

export function edgeCache(): EdgeCache | null {
  const store = (globalThis as { caches?: { default?: EdgeCache } }).caches
  return store?.default ?? null
}

export function resolveEntityId(kind: PreviewKind, payload: unknown, fallback: string): string {
  const root = payload as { id?: unknown; slug?: unknown; profile?: { id?: unknown } } | null
  const raw =
    kind === "person"
      ? root?.profile?.id
      : kind === "signup" || kind === "org"
        ? root?.slug
        : root?.id
  return typeof raw === "string" && isValidPreviewId(raw) ? raw : fallback
}

export function previewContextFor(
  kind: PreviewKind,
  id: string,
  origin: string,
): PreviewContext {
  return { url: `${origin}${CANONICAL_PREFIX[kind]}${id}`, origin }
}

export function buildPreview(
  kind: PreviewKind,
  payload: unknown,
  id: string,
  origin: string,
): LinkPreview | null {
  if (!payload || typeof payload !== "object") return null
  const context = previewContextFor(kind, resolveEntityId(kind, payload, id), origin)
  if (kind === "report") return previewForReport(payload as ReportPreviewInput, context)
  if (kind === "event") return previewForEvent(payload as EventPreviewInput, context)
  if (kind === "signup") return previewForSignupPage(payload as SignupPagePreviewInput, context)
  if (kind === "org") return previewForOrganization(payload as OrganizationPreviewInput, context)
  const profile = (payload as { profile?: unknown }).profile
  if (!profile || typeof profile !== "object") return null
  return previewForPerson(profile as PersonPreviewInput, context)
}

type UpstreamBody =
  | { body: string; outcome: "found" }
  | { body: null; outcome: "missing" | "transient" }

async function fetchUpstreamBody(
  kind: PreviewKind,
  id: string,
  apiBase: string,
): Promise<UpstreamBody> {
  try {
    const response = await fetch(buildUpstreamRequest(kind, id, apiBase))
    const outcome = upstreamOutcome(response.status)
    if (outcome !== "found") return { body: null, outcome }
    return { body: await response.text(), outcome: "found" }
  } catch {
    return { body: null, outcome: "transient" }
  }
}

export interface LoadedPayload {
  payload: unknown | null
  outcome: PreviewOutcome
}

export async function loadPayload(
  kind: PreviewKind,
  id: string,
  requestUrl: string,
  env: PreviewEnv,
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<LoadedPayload> {
  const cache = edgeCache()
  const apiBase = apiBaseFor(requestUrl, env)
  const key = new Request(previewCacheKey(kind, id, apiHostOf(apiBase)), { method: "GET" })

  if (cache) {
    const hit = await cache.match(key).catch(() => undefined)
    if (hit) {
      const cached = negativeCacheOutcome(hit)
      if (cached) return { payload: null, outcome: cached }
      const payload = await hit.json().catch(() => null)
      return { payload, outcome: payload === null ? "transient" : "found" }
    }
  }

  const upstream = await fetchUpstreamBody(kind, id, apiBase)
  const entry =
    upstream.body === null
      ? negativeCacheResponse(upstream.outcome)
      : cacheablePayloadResponse(upstream.body)
  if (cache) {
    const stored = cache.put(key, entry).catch(() => undefined)
    if (waitUntil) waitUntil(stored)
  }
  if (upstream.body === null) return { payload: null, outcome: upstream.outcome }
  try {
    return { payload: JSON.parse(upstream.body) as unknown, outcome: "found" }
  } catch {
    return { payload: null, outcome: "transient" }
  }
}

export async function runPreview(
  context: PreviewContextArg,
  kind: PreviewKind,
  deps: PreviewDeps,
): Promise<Response> {
  const { request, env } = context
  const route = parsePreviewRoute(request.method, context.params.path)

  if (route.action === "passthrough") {
    return withPervasiveHeaders(await env.ASSETS.fetch(request))
  }

  if (route.action === "browse") {
    return htmlResponse(await env.ASSETS.fetch(new URL(BROWSE_PATH[kind], request.url)))
  }

  const shell = await env.ASSETS.fetch(new URL(SHELL_PATH[kind], request.url))
  if (route.action === "shell" || !shell.ok) return htmlResponse(shell)

  const origin = resolveSiteOrigin(request.url)
  const { payload, outcome } = await loadPayload(kind, route.id, request.url, env, context.waitUntil)
  const built =
    buildPreview(kind, payload, route.id, origin) ??
    defaultPreview(previewContextFor(kind, route.id, origin))
  const preview = shouldNoindex(origin, outcome) ? withNoindex(built) : built
  return htmlResponse(deps.rewrite(shell, preview))
}
