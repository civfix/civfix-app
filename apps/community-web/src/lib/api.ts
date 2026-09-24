"use client"

import { createApiClient, type ApiClient } from "@civfix/shared/client"

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

/** Safe to import on the server: createApiClient performs no I/O until a method is called. */
export const api: ApiClient = createApiClient({
  baseURL: API_BASE_URL,
  fetchImpl: resolveFetch(),
  defaultHeaders: {
    "x-client": "web",
  },
  getCsrfToken: resolveCsrfToken,
  onUnauthorized: () => useAuthStore.getState().clear(),
})

