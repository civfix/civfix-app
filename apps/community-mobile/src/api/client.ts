import { createApiClient, type ApiClient } from "@civfix/shared/client"
import { API_URL } from "@/config"
import { readToken, clearToken } from "@/auth/storage"
import { carriedBearerToken, makeSessionTeardown, makeSingleFlight } from "@/api/unauthorized"

let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

const signalUnauthorized = makeSingleFlight(
  (bearer: string) => bearer,
  makeSessionTeardown({
    readToken,
    clearToken,
    onTornDown: () => unauthorizedHandler?.(),
  }),
  (err) => console.warn("[auth] could not complete sign-out after a 401", err),
)

const fetchWithSessionGuard: typeof fetch = async (input, init) => {
  const response = await globalThis.fetch(input, init)
  if (response.status === 401) {
    const bearer = carriedBearerToken(init?.headers)
    if (bearer) signalUnauthorized(bearer)
  }
  return response
}

export const api: ApiClient = createApiClient({
  baseURL: API_URL,
  fetchImpl: fetchWithSessionGuard,
  defaultHeaders: {
    "X-Client": "mobile",
  },
  getAuthHeader: async () => {
    const read = await readToken()
    if (!read.ok) {
      throw new Error("civfix: secure session storage is unavailable; not sending this request")
    }
    return read.token ? { Authorization: `Bearer ${read.token}` } : undefined
  },
})
