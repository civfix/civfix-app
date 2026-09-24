import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import type { UserDTO } from "@civfix/shared"

import { runGatedAction } from "@/hooks/use-auth-gate"
import { useAuthStore, deriveInitialState, SESSION_SETTLE_TIMEOUT_MS } from "@/store/auth-store"

/**
 * The auth gate's CSRF boot-race deferral (runGatedAction is the non-hook core useAuthGate wraps):
 *  - confirmed-authenticated taps run at once; signed-out taps open the auth modal (the original gate).
 *  - a tap in the OPTIMISTIC boot window (snapshot-authenticated, csrfToken still null) DEFERS until
 *    the session check settles, then runs the action with the live token in the store - it must never
 *    fire the mutation tokenless into the backend's csrfProtect 403.
 *  - hydration answering "signed out" (expired session) falls back to the auth modal.
 *  - a hung /auth/session cannot wedge the tap: past the settle timeout the gate treats the viewer as
 *    signed-out and opens the modal, and a LATE hydration must not replay the action.
 */

const USER: UserDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Ada",
  role: "citizen",
  locale: "en",
  createdAt: "2026-01-01T00:00:00.000Z",
}

/** Map-backed localStorage stand-in (node env has none) so setSession's snapshot writes work. */
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
  }
}

/** Boot the store into the optimistic window: snapshot-authenticated, no CSRF token yet. */
function bootOptimistic(): void {
  useAuthStore.setState({ ...deriveInitialState(USER), csrfToken: null, roles: [] })
}

/** Flush the microtask/macrotask queue so a settled deferral's .then callback has run (real timers). */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

let action: ReturnType<typeof vi.fn>
let openAuthModal: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: makeStorage() })
  useAuthStore.setState({ status: "idle", user: null, csrfToken: null, roles: [], optimistic: false })
  action = vi.fn()
  openAuthModal = vi.fn()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("runGatedAction: settled states (original gate behavior)", () => {
  it("runs the action synchronously when the session is live-confirmed", () => {
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-abc", roles: ["citizen"] })
    runGatedAction(action, openAuthModal)
    expect(action).toHaveBeenCalledTimes(1)
    expect(openAuthModal).not.toHaveBeenCalled()
  })

  it("opens the auth modal when anonymous", () => {
    useAuthStore.getState().setAnonymous()
    runGatedAction(action, openAuthModal)
    expect(openAuthModal).toHaveBeenCalledTimes(1)
    expect(action).not.toHaveBeenCalled()
  })

  it("opens the auth modal on a cold boot (idle, no snapshot)", () => {
    runGatedAction(action, openAuthModal)
    expect(openAuthModal).toHaveBeenCalledTimes(1)
    expect(action).not.toHaveBeenCalled()
  })
})

describe("runGatedAction: optimistic boot window", () => {
  it("defers the action instead of firing it tokenless", async () => {
    bootOptimistic()
    runGatedAction(action, openAuthModal)
    await flush()
    // Neither outcome yet: the tap is parked until the session check settles.
    expect(action).not.toHaveBeenCalled()
    expect(openAuthModal).not.toHaveBeenCalled()
    // Settle so the deferral (and its internal timeout) resolves before the test ends.
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-live", roles: ["citizen"] })
    await flush()
  })

  it("runs the deferred action once hydration confirms the session (token now in the store)", async () => {
    bootOptimistic()
    runGatedAction(action, openAuthModal)
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-live", roles: ["citizen"] })
    await flush()
    expect(action).toHaveBeenCalledTimes(1)
    expect(openAuthModal).not.toHaveBeenCalled()
    // The action now runs against a store that holds the live CSRF token.
    expect(useAuthStore.getState().csrfToken).toBe("csrf-live")
  })

  it("falls back to the auth modal when hydration answers signed-out (expired session)", async () => {
    bootOptimistic()
    runGatedAction(action, openAuthModal)
    useAuthStore.getState().setSession({ user: null, roles: [] })
    await flush()
    expect(openAuthModal).toHaveBeenCalledTimes(1)
    expect(action).not.toHaveBeenCalled()
  })

  it("falls back to the auth modal when the network-failure path gives up (setAnonymous)", async () => {
    bootOptimistic()
    runGatedAction(action, openAuthModal)
    useAuthStore.getState().setAnonymous()
    await flush()
    expect(openAuthModal).toHaveBeenCalledTimes(1)
    expect(action).not.toHaveBeenCalled()
  })

  it("times out safely: a hung session check opens the modal and a late hydration never replays the action", async () => {
    vi.useFakeTimers()
    bootOptimistic()
    runGatedAction(action, openAuthModal)
    await vi.advanceTimersByTimeAsync(SESSION_SETTLE_TIMEOUT_MS)
    // No live answer inside the ceiling: treated as signed-out, never fired tokenless.
    expect(openAuthModal).toHaveBeenCalledTimes(1)
    expect(action).not.toHaveBeenCalled()
    // Hydration lands AFTER the timeout: the parked tap must not replay out of nowhere.
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-late", roles: ["citizen"] })
    await vi.advanceTimersByTimeAsync(0)
    expect(action).not.toHaveBeenCalled()
    expect(openAuthModal).toHaveBeenCalledTimes(1)
  })

  it("coalesces repeat taps in the window: a double tap replays the action once, not twice", async () => {
    bootOptimistic()
    const second = vi.fn()
    runGatedAction(action, openAuthModal)
    runGatedAction(second, openAuthModal)
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-live", roles: ["citizen"] })
    await flush()
    expect(action).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
    expect(openAuthModal).not.toHaveBeenCalled()
  })

  it("accepts a new deferred tap once the previous one has settled", async () => {
    vi.useFakeTimers()
    bootOptimistic()
    runGatedAction(action, openAuthModal, 50)
    await vi.advanceTimersByTimeAsync(50)
    expect(openAuthModal).toHaveBeenCalledTimes(1)
    bootOptimistic()
    const next = vi.fn()
    runGatedAction(next, openAuthModal)
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf-live", roles: ["citizen"] })
    await vi.advanceTimersByTimeAsync(0)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it("honors a caller-supplied timeout", async () => {
    vi.useFakeTimers()
    bootOptimistic()
    runGatedAction(action, openAuthModal, 50)
    await vi.advanceTimersByTimeAsync(49)
    expect(openAuthModal).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(openAuthModal).toHaveBeenCalledTimes(1)
    expect(action).not.toHaveBeenCalled()
  })
})
