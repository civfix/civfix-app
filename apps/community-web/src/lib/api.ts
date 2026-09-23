"use client"

import { createApiClient, type ApiClient } from "@civfix/shared/client"
import { AppError, ErrorCode } from "@civfix/shared"

import { getCsrfToken, useAuthStore, waitForSessionSettled } from "@/store/auth-store"

/** NEXT_PUBLIC_ vars are inlined into the static export, so changing this needs a rebuild. */
export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "http://localhost:8080"

/**
 * The Next prerender of the shell has no window, so this falls back to globalThis.fetch and module
 * evaluation never throws.
 */
function resolveFetch(): typeof fetch {
  if (typeof window !== "undefined" && typeof window.fetch === "function") {
    return window.fetch.bind(window)
  }
  return globalThis.fetch
}

/**
 * An optimistic boot restores "authenticated" from the snapshot with no CSRF token until the session
 * check lands, so a mutation in that window would get a silent 403. It waits for the check to settle
 * (bounded by SESSION_SETTLE_TIMEOUT_MS); an expired session or a timeout still has no token and fails
 * through the normal error path. No deadlock: GET /auth/session is csrf:false and never enters here.
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
      try {
        useAuthStore.getState().clear()
      } catch {
        // The store can be unavailable before hydration.
      }
    },
  })
  return cachedClient
}

/** Safe to import on the server: createApiClient performs no I/O until a method is called. */
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
 * Never produces user-facing copy: the render site localizes by `code` (lib/error-messages.ts). The
 * English literals below are diagnostics carried as `AppError.message`.
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
