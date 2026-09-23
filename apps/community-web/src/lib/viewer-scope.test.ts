import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import type { UserDTO } from "@civfix/shared"

const adoptPostComposerViewer = vi.fn()

vi.mock("@civfix/ui", () => ({
  adoptPostComposerViewer: (viewerId: string | null) => adoptPostComposerViewer(viewerId),
}))

const { installViewerScope } = await import("@/lib/viewer-scope")
const { readClaimHandoff, saveClaimHandoff } = await import("@/store/claim-handoff")
const { useAuthStore } = await import("@/store/auth-store")

const STORAGE_KEY = "civfix.query.cache.v2"

const USER_A: UserDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Ada Lovelace",
  handle: "ada",
  role: "citizen",
  locale: "en",
  profileComplete: true,
  createdAt: "2026-01-01T00:00:00.000Z",
}
const USER_B: UserDTO = { ...USER_A, id: "22222222-2222-4222-8222-222222222222", handle: "bea" }

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
let qc: QueryClient
let teardown: () => void

function seedViewerState(): void {
  qc.setQueryData(["notifications", 20], { items: ["private"] })
  qc.setQueryData(["volunteer", "me"], { totalHours: 12 })
  storage.setItem(STORAGE_KEY, "{}")
  saveClaimHandoff({ reportId: "report-1", claimCode: "CLAIM-CODE-1" })
}

function expectViewerStateGone(): void {
  expect(qc.getQueryCache().getAll()).toHaveLength(0)
  expect(storage.map.has(STORAGE_KEY)).toBe(false)
  expect(readClaimHandoff()).toBeNull()
}

beforeEach(() => {
  storage = makeStorage()
  vi.stubGlobal("window", { localStorage: storage })
  adoptPostComposerViewer.mockReset()
  useAuthStore.getState().clear()
  qc = new QueryClient()
})

afterEach(() => {
  teardown()
  useAuthStore.getState().clear()
  vi.unstubAllGlobals()
})

describe("installViewerScope", () => {
  it("purges the previous viewer's caches and claim handoff on sign-out (or a 401)", () => {
    useAuthStore.getState().setSession({ user: USER_A })
    teardown = installViewerScope(qc)
    seedViewerState()

    useAuthStore.getState().clear()

    expectViewerStateGone()
    expect(adoptPostComposerViewer).toHaveBeenLastCalledWith(null)
  })

  it("purges when a different account signs in without signing out first", () => {
    useAuthStore.getState().setSession({ user: USER_A })
    teardown = installViewerScope(qc)
    seedViewerState()

    useAuthStore.getState().setSession({ user: USER_B })

    expectViewerStateGone()
    expect(adoptPostComposerViewer).toHaveBeenLastCalledWith(USER_B.id)
  })

  it("keeps the claim handoff when a guest signs in, so their anonymous report can still be claimed", () => {
    teardown = installViewerScope(qc)
    saveClaimHandoff({ reportId: "report-1", claimCode: "CLAIM-CODE-1" })
    qc.setQueryData(["cleanups", "upcoming"], { items: [] })

    useAuthStore.getState().setSession({ user: USER_B })

    expect(readClaimHandoff()).toEqual({ reportId: "report-1", claimCode: "CLAIM-CODE-1" })
    expect(qc.getQueryData(["cleanups", "upcoming"])).toEqual({ items: [] })
  })

  it("keeps everything when the same viewer's session or profile is refreshed", () => {
    useAuthStore.getState().setSession({ user: USER_A })
    teardown = installViewerScope(qc)
    seedViewerState()

    useAuthStore.getState().setSession({ user: { ...USER_A, displayName: "Ada L." } })

    expect(qc.getQueryData(["notifications", 20])).toEqual({ items: ["private"] })
    expect(readClaimHandoff()).not.toBeNull()
  })

  it("hands the current viewer to the post composer at install and on every change", () => {
    useAuthStore.getState().setSession({ user: USER_A })
    teardown = installViewerScope(qc)
    expect(adoptPostComposerViewer).toHaveBeenLastCalledWith(USER_A.id)

    teardown()
    useAuthStore.getState().clear()
    expect(adoptPostComposerViewer).toHaveBeenCalledTimes(1)
  })
})
