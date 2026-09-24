import { z } from "zod"
import { AppErrorSchema } from "../schemas/common.js"
import { AppError, ErrorCode, isAppErrorLike } from "../types/errors.js"
import {
  endpoints,
  type EndpointDef,
  type EndpointName,
  type Endpoints,
  type RequestOf,
  type ResponseOf,
} from "./endpoints.js"
import { versionedPath } from "./versioning.js"

export type HeaderInit = Record<string, string>
export type MaybeAsync<T> = T | Promise<T>

export interface CreateApiClientOptions {
  baseURL: string
  /** Returns auth headers (e.g. { Authorization: "Bearer ..." }) for required/optional endpoints. */
  getAuthHeader?: () => MaybeAsync<HeaderInit | undefined>
  /** Returns the CSRF token value injected as `x-csrf-token` for csrf endpoints. */
  getCsrfToken?: () => MaybeAsync<string | undefined>
  /** Injected fetch. Defaults to globalThis.fetch (works in browser, RN, and Node 22). */
  fetchImpl?: typeof fetch
  /** Called whenever a 401 is observed, before the AppError is thrown. */
  onUnauthorized?: () => void
  /** Default headers merged into every request. */
  defaultHeaders?: HeaderInit
}

/** Per-call options for the low-level request method. */
export interface RequestArgs {
  params?: Record<string, string | number>
  query?: Record<string, unknown>
  /**
   * Input keys to exclude from the serialized query because they were already consumed as PATH params.
   * Prevents a path-param key (e.g. `cleanupId` for /cleanups/:id/messages) from being duplicated into
   * the query string. Only meaningful alongside `query`.
   */
  queryOmitKeys?: ReadonlySet<string>
  body?: unknown
  signal?: AbortSignal
  /** Extra headers for this call only. */
  headers?: HeaderInit
}

const CSRF_HEADER = "x-csrf-token"

/** Replace `:name` segments in a path with encoded param values. Exported for unit testing. */
export function fillPath(path: string, params?: Record<string, string | number>): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, (_m, name: string) => {
    const value = params?.[name]
    if (value === undefined || value === null) {
      throw new AppError(ErrorCode.VALIDATION, `Missing path param ":${name}" for ${path}`)
    }
    return encodeURIComponent(String(value))
  })
}

/**
 * Serialize an input object into a query string. `omitKeys` lists input keys that were already
 * consumed as PATH params and so must NOT be duplicated into the query (e.g. for
 * GET /cleanups/:id/messages the `cleanupId` key fills the path and must not also appear as
 * `?cleanupId=...`). Conventions: arrays repeat the key; nested objects (bbox, near, ...) are
 * JSON-encoded so they survive the query string; scalars are stringified.
 */
export function buildQuery(query?: Record<string, unknown>, omitKeys?: ReadonlySet<string>): string {
  if (!query) return ""
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (omitKeys?.has(key)) continue
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      for (const v of value) sp.append(key, String(v))
    } else if (typeof value === "object") {
      sp.append(key, JSON.stringify(value))
    } else {
      sp.append(key, String(value))
    }
  }
  const qs = sp.toString()
  return qs ? `?${qs}` : ""
}

function joinUrl(baseURL: string, path: string): string {
  const base = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL
  const p = path.startsWith("/") ? path : `/${path}`
  return `${base}${p}`
}

/** Parse a non-2xx Response into a typed AppError (envelope-aware, status fallback). Exported for tests. */
export async function parseError(res: Response, requestId?: string): Promise<AppError> {
  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    payload = undefined
  }
  const parsed = AppErrorSchema.safeParse(payload)
  if (parsed.success) {
    const envelope = parsed.data
    const code = isAppErrorLike(envelope) ? envelope.code : ErrorCode.INTERNAL
    return new AppError(code, envelope.message, {
      httpStatus: res.status,
      ...(envelope.fields !== undefined ? { fields: envelope.fields } : {}),
      requestId: envelope.requestId ?? requestId,
    })
  }
  // Fall back to a status-derived code when the body is not our envelope.
  const fallback: Record<number, ErrorCode> = {
    400: ErrorCode.VALIDATION,
    401: ErrorCode.UNAUTHORIZED,
    403: ErrorCode.FORBIDDEN,
    404: ErrorCode.NOT_FOUND,
    409: ErrorCode.CONFLICT,
    422: ErrorCode.VALIDATION,
    429: ErrorCode.RATE_LIMITED,
  }
  const code = fallback[res.status] ?? ErrorCode.INTERNAL
  return new AppError(code, res.statusText || `HTTP ${res.status}`, {
    httpStatus: res.status,
    requestId,
  })
}

/**
 * Registry descriptor -> endpoint name, so a schema mismatch can be reported against the name callers
 * know ("listCleanups") rather than a bare path. Built once from the registry; the low-level `request`
 * escape hatch may be handed an ad-hoc descriptor, which falls back to "METHOD /path".
 */
const endpointNames: WeakMap<object, string> = new WeakMap()
for (const name of Object.keys(endpoints) as EndpointName[]) {
  endpointNames.set(endpoints[name] as unknown as object, name)
}

/** Endpoint names already warned about, so a mismatching server logs once instead of per call. */
const warnedEndpoints = new Set<string>()

/**
 * Run a 2xx body through the endpoint's response schema so the DTOs' `.default()`s and `.catch()`es
 * actually apply on the read path; without this the inferred types lie whenever the deployed server is
 * older than the client.
 *
 * Never throws: a body that does NOT match the schema is passed through raw after a single console.warn
 * per endpoint, so an unexpected server shape degrades instead of breaking every call. Exported for unit
 * testing.
 */
export function parseResponse<Res>(
  endpoint: EndpointDef<z.ZodTypeAny | null, z.ZodTypeAny>,
  data: unknown,
): Res {
  // No body (204, or an unparsable/empty payload): nothing to validate.
  if (data === undefined) return data as Res
  const parsed = endpoint.response.safeParse(data)
  if (parsed.success) return parsed.data as Res
  const name = endpointNames.get(endpoint as unknown as object) ?? `${endpoint.method} ${endpoint.path}`
  if (!warnedEndpoints.has(name)) {
    warnedEndpoints.add(name)
    console.warn(
      `[@civfix/shared] response for "${name}" did not match its schema; using the raw body.`,
      parsed.error.issues.slice(0, 3),
    )
  }
  return data as Res
}

/** Extract `:param` names from a path literal into an object of string params. */
export type PathParams<P extends string> = P extends `${string}:${infer Param}/${infer Rest}`
  ? { [K in Param | keyof PathParams<`/${Rest}`>]: string | number }
  : P extends `${string}:${infer Param}`
    ? { [K in Param]: string | number }
    : Record<never, never>

type HasParams<P extends string> = keyof PathParams<P> extends never ? false : true

type Extra = Omit<RequestArgs, "body" | "query" | "params">

/** Typed method surface generated from the endpoint registry. */
export type ApiMethods = {
  [N in EndpointName]: Endpoints[N]["request"] extends z.ZodTypeAny
    ? // Endpoint has a typed request (query for GET, body otherwise). Path params, if any, are
      // read from the request object by name, so the single typed input is enough.
      (input: RequestOf<N>, extra?: Extra) => Promise<ResponseOf<N>>
    : HasParams<Endpoints[N]["path"]> extends true
      ? // No request body but the path has params: accept just the params object.
        (params: PathParams<Endpoints[N]["path"]>, extra?: Extra) => Promise<ResponseOf<N>>
      : // No input at all.
        (extra?: Extra) => Promise<ResponseOf<N>>
}

export interface ApiClient extends ApiMethods {
  /** Low-level escape hatch: call any endpoint descriptor with explicit params/query/body. */
  request<Res>(
    endpoint: EndpointDef<z.ZodTypeAny | null, z.ZodTypeAny>,
    args?: RequestArgs,
  ): Promise<Res>
}

/**
 * Create a typed API client. Works in browser, React Native, and Node (inject fetch if needed).
 * Each registry entry becomes a method that infers its request/response from the schema.
 */
export function createApiClient(opts: CreateApiClientOptions): ApiClient {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== "function") {
    throw new AppError(
      ErrorCode.INTERNAL,
      "No fetch implementation available. Pass fetchImpl in environments without a global fetch.",
    )
  }

  async function request<Res>(
    endpoint: EndpointDef<z.ZodTypeAny | null, z.ZodTypeAny>,
    args: RequestArgs = {},
  ): Promise<Res> {
    const url =
      joinUrl(opts.baseURL, fillPath(versionedPath(endpoint), args.params)) +
      buildQuery(args.query, args.queryOmitKeys)

    const headers: HeaderInit = {
      accept: "application/json",
      ...(opts.defaultHeaders ?? {}),
      ...(args.headers ?? {}),
    }

    let body: string | undefined
    if (args.body !== undefined && endpoint.method !== "GET") {
      headers["content-type"] = "application/json"
      body = JSON.stringify(args.body)
    }

    if (endpoint.auth !== "public" && opts.getAuthHeader) {
      const authHeaders = await opts.getAuthHeader()
      if (authHeaders) Object.assign(headers, authHeaders)
    }

    if (endpoint.csrf && opts.getCsrfToken) {
      const csrf = await opts.getCsrfToken()
      if (csrf) headers[CSRF_HEADER] = csrf
    }

    const res = await fetchImpl(url, {
      method: endpoint.method,
      headers,
      ...(body !== undefined ? { body } : {}),
      ...(args.signal ? { signal: args.signal } : {}),
      // Send/receive cookies for the web (cookie session) flows; harmless on RN.
      credentials: "include",
    })

    const requestId = res.headers.get("x-request-id") ?? undefined

    if (!res.ok) {
      if (res.status === 401 && opts.onUnauthorized) opts.onUnauthorized()
      throw await parseError(res, requestId)
    }

    if (res.status === 204) return undefined as unknown as Res

    let data: unknown
    try {
      data = await res.json()
    } catch {
      data = undefined
    }
    return parseResponse<Res>(endpoint, data)
  }

  const client = { request } as ApiClient

  for (const name of Object.keys(endpoints) as EndpointName[]) {
    const endpoint = endpoints[name] as EndpointDef<z.ZodTypeAny | null, z.ZodTypeAny>
    const hasInput = endpoint.request !== null
    const isQuery = endpoint.method === "GET"
    const pathHasParams = /:[A-Za-z0-9_]+/.test(endpoint.path)

    const method = (firstArg?: unknown, maybeExtra?: RequestArgs) => {
      if (!hasInput) {
        // No body/query. If the path has params, the first arg is the params object; otherwise it
        // is the optional per-call extra.
        if (pathHasParams) {
          const params = firstArg as Record<string, string | number> | undefined
          const extra = (maybeExtra ?? {}) as RequestArgs
          return request(endpoint, { ...extra, params })
        }
        const extra = (firstArg ?? {}) as RequestArgs
        return request(endpoint, { ...extra })
      }

      const input = firstArg
      const extra = (maybeExtra ?? {}) as RequestArgs
      // For GET requests the input is the typed query; for others it is the JSON body. Declared
      // path params are pulled from the input object by name (and the keys they consumed are reported
      // so they can be excluded from the GET query rather than duplicated).
      const { params, consumedKeys } = extractParams(endpoint.path, input)
      if (isQuery) {
        return request(endpoint, {
          ...extra,
          params,
          query: input as Record<string, unknown>,
          queryOmitKeys: consumedKeys,
        })
      }
      return request(endpoint, { ...extra, params, body: input })
    }
    ;(client as unknown as Record<string, unknown>)[name] = method
  }

  return client
}

/**
 * Pull declared path params (":id", ":uploadId", ...) out of the typed input object so callers can
 * pass a single typed payload and have both the path and the query/body populated.
 *
 * Returns the resolved `params` (keyed by path-param name) plus `consumedKeys`: the set of INPUT keys
 * those params were read from. For a GET request, `consumedKeys` is excluded from the serialized query
 * so a path-param value is never duplicated as a query param. The consumed key is usually the param
 * name itself, but for the `:id` tolerance it is the matched `*Id`-suffixed key (e.g. `reportId`).
 */
export function extractParams(
  path: string,
  input: unknown,
): { params: Record<string, string | number> | undefined; consumedKeys: ReadonlySet<string> } {
  const names = [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1] as string)
  if (names.length === 0) return { params: undefined, consumedKeys: EMPTY_KEYS }
  const out: Record<string, string | number> = {}
  const consumed = new Set<string>()
  if (input && typeof input === "object") {
    const rec = input as Record<string, unknown>
    for (const name of names) {
      let v = rec[name]
      let sourceKey = name
      // Tolerate the few endpoints whose path says ":id" while the DTO field is "<resource>Id"
      // (e.g. /anon/reports/:id/status carries { reportId }). Only an unambiguous single *Id-suffixed
      // key qualifies: with two, key order would pick the resource, so the param stays unfilled and
      // fillPath refuses the request.
      if ((v === undefined || v === null) && name === "id") {
        const idKeys = Object.keys(rec).filter((k) => /Id$/.test(k))
        const idKey = idKeys.length === 1 ? idKeys[0] : undefined
        if (idKey) {
          v = rec[idKey]
          sourceKey = idKey
        }
      }
      if (typeof v === "string" || typeof v === "number") {
        out[name] = v
        consumed.add(sourceKey)
      }
    }
  }
  return { params: out, consumedKeys: consumed }
}

const EMPTY_KEYS: ReadonlySet<string> = new Set<string>()
