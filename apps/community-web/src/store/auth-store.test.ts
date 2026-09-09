import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createApiClient } from "@civfix/shared/client"
import type { UserDTO } from "@civfix/shared"

import {
  useAuthStore,
  getCsrfToken,
  deriveInitialState,
  selectAuthPending,
  selectAuthResolved,
  waitForSessionSettled,
  SESSION_SETTLE_TIMEOUT_MS,
  type AuthState,
  type AuthStatus,
} from "@/store/auth-store"
import { resolveCsrfToken } from "@/lib/api"
import { readAuthSnapshot, SNAPSHOT_KEY } from "@/lib/auth-snapshot"

/**
 * The CSRF token lifecycle, end to end (statically):
 *  1. setSession stores the token (captured on OTP verify / OAuth-return / reload), getCsrfToken reads
 *     it, and a token-less refresh PRESERVES the previously captured value.
 *  2. The shared API client, wired with getCsrfToken, echoes x-csrf-token on csrf:true endpoints (e.g.
 *     POST /reports) and omits it on csrf:false endpoints (e.g. GET /reports).
 */

const USER: UserDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Ada",
  role: "citizen",
  locale: "en",
  createdAt: "2026-01-01T00:00:00.000Z",
}

/** Map-backed localStorage stand-in (node env has none) so the snapshot writes are observable. */
function makeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string): string | null => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string): void => {
      map.set(key, value)
    },
    removeItem: (key: string): void => {
      map.delete(key)
    },
    map,
  }
}

let storage: ReturnType<typeof makeStorage>

beforeEach(() => {
  // setSession/clear now read & write the localStorage snapshot; stub a fresh store so those writes work
  // and are observable. The node env has no real localStorage.
  storage = makeStorage()
  vi.stubGlobal("window", { localStorage: storage })
  // Reset the singleton store between tests.
  useAuthStore.setState({
    status: "idle",
    user: null,
    csrfToken: null,
    roles: [],
    optimistic: false,
    guestSmsEnabled: undefined,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("auth-store CSRF token", () => {
  it("stores the csrfToken from setSession and exposes it via getCsrfToken", () => {
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-abc", roles: ["citizen"] })
    expect(getCsrfToken()).toBe("csrf-abc")
    expect(useAuthStore.getState().status).toBe("authenticated")
  })

  it("preserves an existing token when a later refresh omits csrfToken (undefined)", () => {
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-abc", roles: ["citizen"] })
    // A /auth/session refresh that returns no csrfToken (undefined) must not wipe the token.
    useAuthStore.getState().setSession({ user: USER, roles: ["citizen"] })
    expect(getCsrfToken()).toBe("csrf-abc")
  })

  it("clears the token on sign-out", () => {
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-abc", roles: ["citizen"] })
    useAuthStore.getState().clear()
    expect(getCsrfToken()).toBeUndefined()
  })

  it("returns undefined when no token is set", () => {
    expect(getCsrfToken()).toBeUndefined()
  })
})

describe("shared client x-csrf-token wiring", () => {
  function clientWithSpy() {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )
    const client = createApiClient({
      baseURL: "http://localhost:8080",
      fetchImpl: fetchSpy as unknown as typeof fetch,
      getCsrfToken: () => getCsrfToken(),
    })
    return { client, fetchSpy }
  }

  function headersOf(fetchSpy: ReturnType<typeof vi.fn>): Record<string, string> {
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
    return (init?.headers as Record<string, string>) ?? {}
  }

  it("sends x-csrf-token on a csrf:true mutation once a session token exists", async () => {
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-xyz", roles: ["citizen"] })
    const { client, fetchSpy } = clientWithSpy()
    // createReport is a csrf:true endpoint.
    await client.createReport({
      category: "trash",
      lat: 34,
      lng: -118,
      geomSource: "manual",
    } as Parameters<typeof client.createReport>[0])
    expect(headersOf(fetchSpy)["x-csrf-token"]).toBe("csrf-xyz")
  })

  it("omits x-csrf-token on a csrf:false read", async () => {
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-xyz", roles: ["citizen"] })
    const { client, fetchSpy } = clientWithSpy()
    // listMyReports (GET /reports) is csrf:false.
    await client.listMyReports({ limit: 3 })
    expect(headersOf(fetchSpy)["x-csrf-token"]).toBeUndefined()
  })

  it("does not send x-csrf-token on a mutation when no token is set", async () => {
    const { client, fetchSpy } = clientWithSpy()
    await client.createReport({
      category: "trash",
      lat: 34,
      lng: -118,
      geomSource: "manual",
    } as Parameters<typeof client.createReport>[0])
    expect(headersOf(fetchSpy)["x-csrf-token"]).toBeUndefined()
  })
})

describe("auth-store optimistic snapshot", () => {
  it("setSession with a user writes the snapshot and confirms (authenticated, not optimistic)", () => {
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-abc", roles: ["citizen"] })
    expect(readAuthSnapshot()).toEqual(USER)
    expect(useAuthStore.getState().status).toBe("authenticated")
    expect(useAuthStore.getState().optimistic).toBe(false)
  })

  it("setSession with a null user clears the snapshot and goes anonymous", () => {
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-abc", roles: ["citizen"] })
    useAuthStore.getState().setSession({ user: null, roles: [] })
    expect(readAuthSnapshot()).toBeNull()
    expect(storage.map.has(SNAPSHOT_KEY)).toBe(false)
    expect(useAuthStore.getState().status).toBe("anonymous")
  })

  it("clear wipes the snapshot", () => {
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-abc", roles: ["citizen"] })
    useAuthStore.getState().clear()
    expect(readAuthSnapshot()).toBeNull()
    expect(storage.map.has(SNAPSHOT_KEY)).toBe(false)
    expect(useAuthStore.getState().status).toBe("anonymous")
    expect(useAuthStore.getState().optimistic).toBe(false)
  })

  it("reverse-flips an optimistic session to anonymous and drops the snapshot when the session expired", () => {
    // Boot optimistically from a snapshot, then the live session check returns signed-out.
    useAuthStore.setState({ ...deriveInitialState(USER), csrfToken: null, roles: [] })
    expect(useAuthStore.getState().optimistic).toBe(true)
    useAuthStore.getState().setSession({ user: null, roles: [] })
    expect(useAuthStore.getState().status).toBe("anonymous")
    expect(useAuthStore.getState().optimistic).toBe(false)
    expect(readAuthSnapshot()).toBeNull()
  })

  it("setStatus clears the optimistic flag (a fetch is in flight)", () => {
    useAuthStore.setState({ ...deriveInitialState(USER), csrfToken: null, roles: [] })
    useAuthStore.getState().setStatus("loading")
    expect(useAuthStore.getState().status).toBe("loading")
    expect(useAuthStore.getState().optimistic).toBe(false)
  })

  it("setAnonymous clears the user with the status, and KEEPS the snapshot for a later retry", () => {
    // The session check failed on the network (no live answer). The signed-out UI must not be able to
    // disagree with itself: a bare setStatus("anonymous") would leave the stale profile readable.
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-abc", roles: ["citizen"] })
    useAuthStore.getState().setAnonymous()
    expect(useAuthStore.getState().status).toBe("anonymous")
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().optimistic).toBe(false)
    // Unlike clear()/setSession(null) this is NOT an answer about the identity, so the cosmetic snapshot
    // (and the CSRF token) survive - the next load can still paint optimistically and re-check.
    expect(readAuthSnapshot()).toEqual(USER)
    expect(getCsrfToken()).toBe("csrf-abc")
  })
})

describe("waitForSessionSettled", () => {
  /** Boot the store into the optimistic window: snapshot-authenticated, no CSRF token yet. */
  function bootOptimistic(): void {
    useAuthStore.setState({ ...deriveInitialState(USER), csrfToken: null, roles: [] })
  }

  it("resolves immediately when the state is not optimistic", async () => {
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-abc", roles: ["citizen"] })
    const settled = await waitForSessionSettled()
    expect(settled.status).toBe("authenticated")
    expect(settled.optimistic).toBe(false)
  })

  it("resolves once hydration confirms the session (token available)", async () => {
    bootOptimistic()
    const pending = waitForSessionSettled()
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-live", roles: ["citizen"] })
    const settled = await pending
    expect(settled.status).toBe("authenticated")
    expect(settled.optimistic).toBe(false)
    expect(settled.csrfToken).toBe("csrf-live")
  })

  it("resolves once hydration reverse-flips the guess to anonymous", async () => {
    bootOptimistic()
    const pending = waitForSessionSettled()
    useAuthStore.getState().setSession({ user: null, roles: [] })
    const settled = await pending
    expect(settled.status).toBe("anonymous")
    expect(settled.optimistic).toBe(false)
  })

  it("resolves with the still-optimistic state on timeout, without mutating the store", async () => {
    vi.useFakeTimers()
    try {
      bootOptimistic()
      const pending = waitForSessionSettled()
      await vi.advanceTimersByTimeAsync(SESSION_SETTLE_TIMEOUT_MS)
      const settled = await pending
      // No live answer arrived: the resolved state still carries the optimistic guess (callers treat
      // that as signed-out for decision purposes), and the store itself is untouched - a late
      // hydration can still land normally.
      expect(settled.optimistic).toBe(true)
      expect(useAuthStore.getState().optimistic).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("resolveCsrfToken boot-race wiring (async token getter)", () => {
  function bootOptimistic(): void {
    useAuthStore.setState({ ...deriveInitialState(USER), csrfToken: null, roles: [] })
  }

  function clientWithSpy() {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )
    const client = createApiClient({
      baseURL: "http://localhost:8080",
      fetchImpl: fetchSpy as unknown as typeof fetch,
      // The REAL wiring from lib/api.ts (the shared client awaits the getter for csrf endpoints).
      getCsrfToken: resolveCsrfToken,
    })
    return { client, fetchSpy }
  }

  function headersOf(fetchSpy: ReturnType<typeof vi.fn>): Record<string, string> {
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
    return (init?.headers as Record<string, string>) ?? {}
  }

  it("holds a mutation fired in the optimistic window until hydration, then sends the live token", async () => {
    bootOptimistic()
    const { client, fetchSpy } = clientWithSpy()
    // Fire the mutation DURING the boot window (this is the reported RSVP race).
    const inFlight = client.createReport({
      category: "trash",
      lat: 34,
      lng: -118,
      geomSource: "manual",
    } as Parameters<typeof client.createReport>[0])
    // The request must not have gone out tokenless while the session is unhydrated (flush a macrotask
    // so the client's async pipeline has had every chance to run up to the awaited getter).
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetchSpy).not.toHaveBeenCalled()
    // Hydration lands (AuthHydrator applies GET /auth/session).
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-live", roles: ["citizen"] })
    await inFlight
    expect(headersOf(fetchSpy)["x-csrf-token"]).toBe("csrf-live")
  })

  it("releases the request tokenless after the settle timeout (normal error path, no wedge)", async () => {
    vi.useFakeTimers()
    try {
      bootOptimistic()
      const { client, fetchSpy } = clientWithSpy()
      const inFlight = client.createReport({
        category: "trash",
        lat: 34,
        lng: -118,
        geomSource: "manual",
      } as Parameters<typeof client.createReport>[0])
      await vi.advanceTimersByTimeAsync(SESSION_SETTLE_TIMEOUT_MS)
      await inFlight
      // The mutation is released (the UI is not wedged) but without the header - it will surface the
      // backend's 403 through the caller's normal error handling instead of hanging forever.
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(headersOf(fetchSpy)["x-csrf-token"]).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it("passes straight through outside the optimistic window", async () => {
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-abc", roles: ["citizen"] })
    await expect(resolveCsrfToken()).resolves.toBe("csrf-abc")
  })
})

describe("deriveInitialState", () => {
  it("maps a snapshot user to optimistically authenticated", () => {
    expect(deriveInitialState(USER)).toEqual({
      status: "authenticated",
      user: USER,
      optimistic: true,
    })
  })

  it("maps no snapshot to idle / not optimistic", () => {
    expect(deriveInitialState(null)).toEqual({ status: "idle", user: null, optimistic: false })
  })
})

describe("auth-store guestSmsEnabled", () => {
  it("is undefined until a session response advertises it, so the SMS option stays hidden", () => {
    expect(useAuthStore.getState().guestSmsEnabled).toBeUndefined()
    useAuthStore.getState().setSession({ user: null, roles: [] })
    expect(useAuthStore.getState().guestSmsEnabled).toBeUndefined()
  })

  it("captures the flag from a signed-out session check", () => {
    useAuthStore.getState().setSession({ user: null, roles: [], guestSmsEnabled: true })
    expect(useAuthStore.getState().guestSmsEnabled).toBe(true)
  })

  it("preserves the known flag when a later response omits it (server config, not user state)", () => {
    useAuthStore.getState().setSession({ user: null, roles: [], guestSmsEnabled: true })
    useAuthStore.getState().setSession({ user: USER, roles: ["citizen"] })
    expect(useAuthStore.getState().guestSmsEnabled).toBe(true)
    useAuthStore.getState().clear()
    expect(useAuthStore.getState().guestSmsEnabled).toBe(true)
  })

  it("honours a server that turns the channel off", () => {
    useAuthStore.getState().setSession({ user: null, roles: [], guestSmsEnabled: true })
    useAuthStore.getState().setSession({ user: null, roles: [], guestSmsEnabled: false })
    expect(useAuthStore.getState().guestSmsEnabled).toBe(false)
  })
})

describe("selectAuthPending / selectAuthResolved", () => {
  const withStatus = (status: AuthStatus): AuthState => ({ status }) as AuthState

  it("treats idle and loading as pending (unresolved)", () => {
    for (const status of ["idle", "loading"] as const) {
      expect(selectAuthPending(withStatus(status))).toBe(true)
      expect(selectAuthResolved(withStatus(status))).toBe(false)
    }
  })

  it("treats authenticated and anonymous as resolved", () => {
    for (const status of ["authenticated", "anonymous"] as const) {
      expect(selectAuthPending(withStatus(status))).toBe(false)
      expect(selectAuthResolved(withStatus(status))).toBe(true)
    }
  })
})
