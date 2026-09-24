import * as React from "react"
import { act, cleanup, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AppError, ErrorCode, type UserDTO } from "@civfix/shared"

import type * as ApiModule from "@/lib/api"
import { queryKeys } from "@/lib/query"

const logout = vi.fn()
const session = vi.fn()

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  api: {
    logout: (...args: unknown[]) => logout(...args),
    session: (...args: unknown[]) => session(...args),
  },
}))

const { SIGN_OUT_DEADLINE_MS, useLogout, useRefreshSession } = await import("@/hooks/use-auth")
const { resolveCsrfToken } = await import("@/lib/api")
const { useAuthStore } = await import("@/store/auth-store")
const { useSignOutRetryStore } = await import("@/store/sign-out-retry-store")

const USER: UserDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Ada Lovelace",
  handle: "ada",
  role: "citizen",
  locale: "en",
  profileComplete: true,
  createdAt: "2026-01-01T00:00:00.000Z",
}

const CACHE_KEY = "civfix.query.cache.v2"

let queryClient: QueryClient

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

async function signOut(): Promise<void> {
  const { result } = renderHook(() => useLogout(), { wrapper })
  await act(async () => {
    await result.current()
  })
}

function expectStillSignedIn(): void {
  expect(useAuthStore.getState()).toMatchObject({ status: "authenticated", user: USER })
  expect(queryClient.getQueryData(["notifications", 20])).toEqual({ items: ["private"] })
  expect(window.localStorage.getItem(CACHE_KEY)).toBe("{}")
}

beforeEach(() => {
  logout.mockReset()
  session.mockReset()
  window.localStorage.clear()
  queryClient = new QueryClient()
  useSignOutRetryStore.setState({ pending: false, failed: false })
  useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-a" })
  queryClient.setQueryData(["notifications", 20], { items: ["private"] })
  window.localStorage.setItem(CACHE_KEY, "{}")
})

afterEach(() => {
  cleanup()
  useAuthStore.getState().clear()
  vi.useRealTimers()
})

describe("useLogout", () => {
  it("keeps the user visibly signed in when the request never reached the server", async () => {
    logout.mockRejectedValue(new TypeError("Failed to fetch"))

    await signOut()

    expectStillSignedIn()
    expect(useSignOutRetryStore.getState()).toMatchObject({ pending: false, failed: true })
  })

  it("keeps the user signed in on a server error, because the session cookie survives it", async () => {
    logout.mockRejectedValue(
      new AppError(ErrorCode.INTERNAL, "boom", { httpStatus: 500 }),
    )

    await signOut()

    expectStillSignedIn()
    expect(useSignOutRetryStore.getState().failed).toBe(true)
  })

  it("counts an already-expired session (UNAUTHORIZED) as signed out", async () => {
    logout.mockRejectedValue(new AppError(ErrorCode.UNAUTHORIZED, "expired", { httpStatus: 401 }))

    await signOut()

    expect(useAuthStore.getState().user).toBeNull()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(window.localStorage.getItem(CACHE_KEY)).toBeNull()
    expect(useSignOutRetryStore.getState().failed).toBe(false)
  })

  it("clears everything once the server confirmed the sign-out", async () => {
    logout.mockResolvedValue({ ok: true })

    await signOut()

    expect(useAuthStore.getState()).toMatchObject({ status: "anonymous", user: null })
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(window.localStorage.getItem(CACHE_KEY)).toBeNull()
    expect(useSignOutRetryStore.getState()).toMatchObject({ pending: false, failed: false })
  })

  it("a retry after a failure re-runs the normal sign-out and clears the notice", async () => {
    logout.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    await signOut()
    expect(useSignOutRetryStore.getState().failed).toBe(true)

    logout.mockResolvedValueOnce({ ok: true })
    await signOut()

    expect(useAuthStore.getState().user).toBeNull()
    expect(useSignOutRetryStore.getState().failed).toBe(false)
  })

  it("gives up on a sign-out request that never answers, so the retry is never stuck behind it", async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    logout.mockImplementation((options: { signal?: AbortSignal }) => {
      signal = options.signal
      return new Promise(() => undefined)
    })

    const { result } = renderHook(() => useLogout(), { wrapper })
    let pending!: Promise<void>
    act(() => {
      pending = result.current()
    })
    expect(useSignOutRetryStore.getState().pending).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(SIGN_OUT_DEADLINE_MS)
      await pending
    })

    expect(signal?.aborted).toBe(true)
    expect(useSignOutRetryStore.getState()).toMatchObject({ pending: false, failed: true })
    expectStillSignedIn()
  })

  it("raises no notice when the session ended another way while the request was in flight", async () => {
    let fail!: (err: unknown) => void
    logout.mockImplementation(() => new Promise((_, reject) => (fail = reject)))

    const { result } = renderHook(() => useLogout(), { wrapper })
    let pending!: Promise<void>
    act(() => {
      pending = result.current()
    })
    await act(async () => {
      useAuthStore.getState().clear()
      fail(new TypeError("Failed to fetch"))
      await pending
    })

    expect(useSignOutRetryStore.getState()).toMatchObject({ pending: false, failed: false })
  })

  it("sends the CSRF token the settled session holds, never one captured during the boot window", async () => {
    useAuthStore.setState({ csrfToken: null, optimistic: true })
    const tokensAtCall: (string | undefined)[] = []
    logout.mockImplementation(async (...args: unknown[]) => {
      expect(args).toEqual([{ signal: expect.any(AbortSignal) }])
      tokensAtCall.push(await resolveCsrfToken())
      throw new TypeError("Failed to fetch")
    })

    const { result } = renderHook(() => useLogout(), { wrapper })
    let pending!: Promise<void>
    act(() => {
      pending = result.current()
    })
    await act(async () => {
      useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-b" })
      await pending
    })

    logout.mockClear()
    await act(async () => {
      await result.current()
    })

    expect(tokensAtCall).toEqual(["csrf-b", "csrf-b"])
    expectStillSignedIn()
  })
})

describe("useRefreshSession", () => {
  it("refetches the viewer's service hours under the new identity", async () => {
    queryClient.setQueryData(["volunteer", "me"], { totalHours: 12 })
    session.mockResolvedValue({ authenticated: true, user: USER, csrfToken: "csrf-b", roles: [] })
    const { result } = renderHook(() => useRefreshSession(), { wrapper })

    await act(async () => {
      await result.current()
    })

    expect(queryClient.getQueryState(["volunteer", "me"])?.isInvalidated).toBe(true)
  })

  it("invalidates the viewer-flagged post families when the identity changes", async () => {
    queryClient.setQueryData(queryKeys.post("p1"), { id: "p1", likedByMe: false })
    queryClient.setQueryData(queryKeys.homeFeed("all", "public"), { items: [] })
    queryClient.setQueryData(queryKeys.mapReports(null, []), { pins: [] })
    queryClient.setQueryData(queryKeys.report("r1"), { id: "r1" })
    queryClient.setQueryData(queryKeys.cleanupAttendees("c1"), { items: [] })
    queryClient.setQueryData(queryKeys.chatHistory("room", "group"), { messages: [] })
    session.mockResolvedValue({ authenticated: true, user: USER, csrfToken: "csrf-b", roles: [] })
    const { result } = renderHook(() => useRefreshSession(), { wrapper })

    await act(async () => {
      await result.current()
    })

    expect(queryClient.getQueryState(queryKeys.post("p1"))?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(queryKeys.homeFeed("all", "public"))?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(queryKeys.mapReports(null, []))?.isInvalidated).toBe(false)
    expect(queryClient.getQueryState(queryKeys.report("r1"))?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(queryKeys.cleanupAttendees("c1"))?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(queryKeys.chatHistory("room", "group"))?.isInvalidated).toBe(true)
  })
})
