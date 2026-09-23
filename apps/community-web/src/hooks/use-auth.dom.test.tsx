import * as React from "react"
import { act, cleanup, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AppError, ErrorCode, type UserDTO } from "@civfix/shared"

import type * as ApiModule from "@/lib/api"

const logout = vi.fn()
const session = vi.fn()

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  api: {
    logout: (...args: unknown[]) => logout(...args),
    session: (...args: unknown[]) => session(...args),
  },
}))

const { useLogout, useRefreshSession, retrySignOut } = await import("@/hooks/use-auth")
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

beforeEach(() => {
  logout.mockReset()
  session.mockReset()
  window.localStorage.clear()
  queryClient = new QueryClient()
  useSignOutRetryStore.setState({ failures: 0, csrfToken: null })
  useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-a" })
})

afterEach(() => {
  cleanup()
  useAuthStore.getState().clear()
})

describe("useLogout", () => {
  it("still signs out locally when the request never reached the server, and asks for a retry", async () => {
    logout.mockRejectedValue(new TypeError("Failed to fetch"))

    await signOut()

    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().status).toBe("anonymous")
    expect(useSignOutRetryStore.getState()).toMatchObject({ failures: 1, csrfToken: "csrf-a" })
  })

  it("treats a server error as a failed sign-out, because the session cookie survives it", async () => {
    logout.mockRejectedValue(
      new AppError(ErrorCode.INTERNAL, "boom", { httpStatus: 500 }),
    )

    await signOut()

    expect(useAuthStore.getState().user).toBeNull()
    expect(useSignOutRetryStore.getState().failures).toBe(1)
  })

  it("counts an already-expired session (UNAUTHORIZED) as signed out", async () => {
    logout.mockRejectedValue(new AppError(ErrorCode.UNAUTHORIZED, "expired", { httpStatus: 401 }))

    await signOut()

    expect(useAuthStore.getState().user).toBeNull()
    expect(useSignOutRetryStore.getState().failures).toBe(0)
  })

  it("asks for nothing more when the server confirmed the sign-out", async () => {
    logout.mockResolvedValue({ ok: true })

    await signOut()

    expect(useAuthStore.getState().user).toBeNull()
    expect(useSignOutRetryStore.getState().failures).toBe(0)
  })
})

describe("retrySignOut", () => {
  it("re-posts with the CSRF token of the session being ended, then settles", async () => {
    logout.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    await signOut()

    logout.mockResolvedValueOnce({ ok: true })
    await retrySignOut()

    expect(logout).toHaveBeenLastCalledWith({ headers: { "x-csrf-token": "csrf-a" } })
    expect(useSignOutRetryStore.getState().csrfToken).toBeNull()
  })

  it("asks again when the retry fails too", async () => {
    logout.mockRejectedValue(new TypeError("Failed to fetch"))
    await signOut()

    await retrySignOut()

    expect(useSignOutRetryStore.getState()).toMatchObject({ failures: 2, csrfToken: "csrf-a" })
  })

  it("never ends a session that someone has signed in to since", async () => {
    logout.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    await signOut()
    logout.mockClear()
    useAuthStore.getState().setSession({ user: { ...USER, id: "22222222-2222-4222-8222-222222222222" } })

    await retrySignOut()

    expect(logout).not.toHaveBeenCalled()
    expect(useSignOutRetryStore.getState().csrfToken).toBeNull()
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
})
