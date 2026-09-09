"use client"

import { createApiClient, type ApiClient } from "@civfix/shared/client"
import { AppError, ErrorCode } from "@civfix/shared"

import { getCsrfToken, useAuthStore, waitForSessionSettled } from "@/store/auth-store"

/**
 * The civfix API base URL. Defaults to the local backend; overridden at build time via
 * NEXT_PUBLIC_API_URL. NEXT_PUBLIC_ vars are inlined into the static export at build time.
 */
export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "http://localhost:8080"

/**
 * Build the typed API client.
 *
 * Auth model (web):
 *  - Session is a httpOnly cookie set by the API. The shared client already sends
 *    `credentials: "include"` on every request, so the cookie rides along automatically.
 *  - Mutations require a CSRF token echoed in the x-csrf-token header. We read it from the auth
 *    store at call time via resolveCsrfToken (the shared client only adds it for csrf endpoints),
 *    which first waits out the optimistic boot window so a mutation never races the hydrator.
 *  - Every request carries `X-Client: web` so the backend can distinguish web from mobile.
 *  - A 401 clears the local auth state so the UI flips back to a signed-out view.
 *
 * `fetchImpl` is bound to window.fetch in the browser. On the server (Next build/prerender of the
 * shell) there is no window; we fall back to globalThis.fetch so module evaluation never throws.
 * No data is fetched during the static export, only the shell is emitted.
 */
function resolveFetch(): typeof fetch {
  if (typeof window !== "undefined" && typeof window.fetch === "function") {
    return window.fetch.bind(window)
  }
  return globalThis.fetch
}

/**
 * Call-time CSRF resolver for the shared client (async: the client awaits it for csrf endpoints only,
 * so reads are never delayed).
 *
 * Boot race: an optimistic boot restores `status:"authenticated"` from the localStorage snapshot with
 * `csrfToken: null` until AuthHydrator applies GET /auth/session. A mutation fired inside that window
 * used to go out WITHOUT the x-csrf-token header and die on the backend's csrfProtect with a silent
 * 403. So while the state is optimistic we wait for the session check to settle (bounded by
 * SESSION_SETTLE_TIMEOUT_MS so a hung backend cannot wedge the caller forever) and only then read the
 * token: a confirmed session proceeds with the real token; if the session actually expired - or the
 * wait timed out - the token is still absent and the request fails loudly through the normal error
 * path instead of racing the hydrator.
 *
 * No deadlock: GET /auth/session is csrf:false, so the hydrator's own request never enters this
 * resolver. The gated UI paths (useAuthGate) additionally defer BEFORE invoking their action; this
 * resolver is the belt-and-braces cover for every mutation that does not run through the gate
 * (composer submitReport, settings/locale sync, profile registration, logout, chat HTTP sends).
 */
export async function resolveCsrfToken(): Promise<string | undefined> {
  if (useAuthStore.getState().optimistic) await waitForSessionSettled()
  return getCsrfToken()
}

let cachedClient: ApiClient | null = null

export function getApiClient(): ApiClient {
  if (cachedClient) return cachedClient
  cachedClient = createApiClient({
    baseURL: API_BASE_URL,
    fetchImpl: resolveFetch(),
    defaultHeaders: {
      "x-client": "web",
    },
    getCsrfToken: resolveCsrfToken,
    onUnauthorized: () => {
      // Flip to signed-out. Guard against running before hydration.
      try {
        useAuthStore.getState().clear()
      } catch {
        // no-op: store not ready
      }
    },
  })
  return cachedClient
}

/**
 * Singleton client for app code. Importing this is safe on the server because createApiClient does
 * not perform any I/O until a method is called.
 */
export const api: ApiClient = getApiClient()

export interface AppErrorLike {
  code: ErrorCode
  message: string
  httpStatus?: unknown
  fields?: unknown
  requestId?: unknown
}

const ERROR_CODE_VALUES: ReadonlySet<string> = new Set<string>(Object.values(ErrorCode))

export function isAppErrorLike(value: unknown): value is AppErrorLike {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as { code?: unknown; message?: unknown }
  return (
    typeof candidate.code === "string" &&
    ERROR_CODE_VALUES.has(candidate.code) &&
    typeof candidate.message === "string"
  )
}

/**
 * Normalize any thrown value into an AppError so UI error states can rely on a consistent shape.
 * The shared client already throws AppError for HTTP failures; this also wraps network errors
 * (e.g. the backend is not running) into a friendly INTERNAL error.
 *
 * i18n note: this is a plain (non-hook) module function, so it cannot call `useT`. It never
 * synthesizes user-facing copy itself — error text is localized at the render site, which maps the
 * AppError's `code` to a localized string via `errorMessage(err, baselineErrorOverrides(t), …)`
 * (see lib/error-messages.ts). The English literals below are only the i18n *default values* for the
 * `web-errors:network_request_failed` / `web-errors:unknown_error` keys; they are last-resort
 * diagnostics (carried as `AppError.message`, not rendered through the localized router) so a
 * non-localized call path still reads sensibly.
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err

  if (isAppErrorLike(err)) {
    const { httpStatus, fields, requestId } = err
    const namedFields =
      typeof fields === "object" && fields !== null && !Array.isArray(fields)
        ? Object.entries(fields).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          )
        : []
    return new AppError(err.code, err.message || "Unknown error", {
      ...(typeof httpStatus === "number" ? { httpStatus } : {}),
      ...(namedFields.length > 0 ? { fields: Object.fromEntries(namedFields) } : {}),
      ...(typeof requestId === "string" ? { requestId } : {}),
      cause: err,
    })
  }

  if (err instanceof Error) {
    // web-errors:network_request_failed (i18n default value)
    return new AppError(ErrorCode.INTERNAL, err.message || "Network request failed", { cause: err })
  }
  // web-errors:unknown_error (i18n default value)
  return new AppError(ErrorCode.INTERNAL, "Unknown error")
}
