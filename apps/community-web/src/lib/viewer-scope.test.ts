import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import type { UserDTO } from "@civfix/shared"

const adoptViewer = vi.fn()
const discardViewerDrafts = vi.fn()

vi.mock("@civfix/ui", () => ({
  adoptViewer: (viewerId: string | null) => adoptViewer(viewerId),
  discardViewerDrafts: () => discardViewerDrafts(),
}))

const { installViewerScope } = await import("@/lib/viewer-scope")
const { readClaimHandoff, saveClaimHandoff } = await import("@/store/claim-handoff")
const { useAuthStore } = await import("@/store/auth-store")
const { useSignOutRetryStore } = await import("@/store/sign-out-retry-store")
const { writeAuthSnapshot } = await import("@/lib/auth-snapshot")

const STORAGE_KEY = "civfix.query.cache.v2"
const UNSYNCED_LOCALE_KEY = "civfix.locale.unsynced"

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
  adoptViewer.mockReset()
  discardViewerDrafts.mockReset()
  useAuthStore.getState().clear()
  useSignOutRetryStore.setState({ pending: false, failed: false })
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
    expect(adoptViewer).toHaveBeenLastCalledWith(null)
    expect(discardViewerDrafts).toHaveBeenCalledTimes(1)
  })

  it("forgets a departed viewer's pending locale sync, on sign-out and on an account switch", () => {
    useAuthStore.getState().setSession({ user: USER_A })
    teardown = installViewerScope(qc)
    storage.setItem(UNSYNCED_LOCALE_KEY, USER_A.id)

    useAuthStore.getState().setAnonymous()
    expect(storage.getItem(UNSYNCED_LOCALE_KEY)).toBe(USER_A.id)

    useAuthStore.getState().clear()
    expect(storage.getItem(UNSYNCED_LOCALE_KEY)).toBeNull()

    useAuthStore.getState().setSession({ user: USER_A })
    storage.setItem(UNSYNCED_LOCALE_KEY, USER_A.id)
    useAuthStore.getState().setSession({ user: USER_B })
    expect(storage.getItem(UNSYNCED_LOCALE_KEY)).toBeNull()
  })

  it("keeps everything through a session check that got no answer, then the same viewer again", () => {
    useAuthStore.getState().setSession({ user: USER_A })
    teardown = installViewerScope(qc)
    seedViewerState()

    useAuthStore.getState().setAnonymous()
    expect(adoptViewer).toHaveBeenLastCalledWith(null)
    useAuthStore.getState().setSession({ user: USER_A })

    expect(qc.getQueryData(["notifications", 20])).toEqual({ items: ["private"] })
    expect(storage.map.has(STORAGE_KEY)).toBe(true)
    expect(readClaimHandoff()).not.toBeNull()
    expect(discardViewerDrafts).not.toHaveBeenCalled()
    expect(adoptViewer).toHaveBeenLastCalledWith(USER_A.id)
  })

  it("purges once a live answer confirms the viewer is gone after a check that got no answer", () => {
    useAuthStore.getState().setSession({ user: USER_A })
    teardown = installViewerScope(qc)
    seedViewerState()

    useAuthStore.getState().setAnonymous()
    useAuthStore.getState().setSession({ user: null })

    expectViewerStateGone()
    expect(discardViewerDrafts).toHaveBeenCalledTimes(1)
  })

  it("purges when a different account arrives after a check that got no answer", () => {
    useAuthStore.getState().setSession({ user: USER_A })
    teardown = installViewerScope(qc)
    seedViewerState()

    useAuthStore.getState().setAnonymous()
    useAuthStore.getState().setSession({ user: USER_B })

    expectViewerStateGone()
    expect(adoptViewer).toHaveBeenLastCalledWith(USER_B.id)
  })

  it("purges when a different account signs in without signing out first", () => {
    useAuthStore.getState().setSession({ user: USER_A })
    teardown = installViewerScope(qc)
    seedViewerState()

    useAuthStore.getState().setSession({ user: USER_B })

    expectViewerStateGone()
    expect(adoptViewer).toHaveBeenLastCalledWith(USER_B.id)
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

  it("keeps a handoff saved while the viewer was unconfirmed when the optimistic snapshot turns out expired", () => {
    writeAuthSnapshot(USER_A)
    useAuthStore.setState({ status: "authenticated", user: USER_A, optimistic: true })
    teardown = installViewerScope(qc)
    saveClaimHandoff({ reportId: "report-1", claimCode: "CLAIM-CODE-1" })

    useAuthStore.getState().setSession({ user: null })

    expect(readClaimHandoff()).toEqual({ reportId: "report-1", claimCode: "CLAIM-CODE-1" })
    expect(qc.getQueryCache().getAll()).toHaveLength(0)
  })

  it("purges only the departed account's handoff when a different account signs in", () => {
    useAuthStore.getState().setSession({ user: USER_A })
    teardown = installViewerScope(qc)
    saveClaimHandoff({ reportId: "report-a", claimCode: "CLAIM-CODE-A" })
    useAuthStore.getState().setSession({ user: USER_B })
    expect(readClaimHandoff()).toBeNull()

    saveClaimHandoff({ reportId: "report-b", claimCode: "CLAIM-CODE-B" })
    useAuthStore.getState().setAnonymous()
    useAuthStore.getState().setSession({ user: USER_B })
    expect(readClaimHandoff()).toEqual({ reportId: "report-b", claimCode: "CLAIM-CODE-B" })
  })

  it("purges a handoff saved during an optimistic boot once that viewer is confirmed and then signs out", () => {
    writeAuthSnapshot(USER_A)
    useAuthStore.setState({ status: "authenticated", user: USER_A, optimistic: true })
    teardown = installViewerScope(qc)
    saveClaimHandoff({ reportId: "report-1", claimCode: "CLAIM-CODE-1" })

    useAuthStore.getState().setSession({ user: USER_A })
    expect(readClaimHandoff()).toEqual({ reportId: "report-1", claimCode: "CLAIM-CODE-1" })
    useAuthStore.getState().clear()

    expect(readClaimHandoff()).toBeNull()
  })

  it("purges a guest's handoff once the account that signed in with it signs out", () => {
    teardown = installViewerScope(qc)
    saveClaimHandoff({ reportId: "report-1", claimCode: "CLAIM-CODE-1" })

    useAuthStore.getState().setSession({ user: USER_A })
    expect(readClaimHandoff()).toEqual({ reportId: "report-1", claimCode: "CLAIM-CODE-1" })
    useAuthStore.getState().clear()

    expect(readClaimHandoff()).toBeNull()
  })

  it("purges a guest's handoff once the account that signed in with it is replaced by another", () => {
    teardown = installViewerScope(qc)
    saveClaimHandoff({ reportId: "report-1", claimCode: "CLAIM-CODE-1" })

    useAuthStore.getState().setSession({ user: USER_A })
    useAuthStore.getState().setSession({ user: USER_B })

    expect(readClaimHandoff()).toBeNull()
  })

  it("keeps a handoff through an expired snapshot, the guest state and the sign-in that comes back to claim it", () => {
    writeAuthSnapshot(USER_A)
    useAuthStore.setState({ status: "authenticated", user: USER_A, optimistic: true })
    teardown = installViewerScope(qc)
    saveClaimHandoff({ reportId: "report-1", claimCode: "CLAIM-CODE-1" })

    useAuthStore.getState().setSession({ user: null })
    useAuthStore.getState().setSession({ user: USER_A })

    expect(readClaimHandoff()).toEqual({ reportId: "report-1", claimCode: "CLAIM-CODE-1" })
  })

  it("drops a failed sign-out's notice once the session ends another way (a 401)", () => {
    useAuthStore.getState().setSession({ user: USER_A })
    teardown = installViewerScope(qc)
    useSignOutRetryStore.setState({ pending: false, failed: true })

    useAuthStore.getState().setAnonymous()
    expect(useSignOutRetryStore.getState().failed).toBe(true)

    useAuthStore.getState().clear()
    expect(useSignOutRetryStore.getState().failed).toBe(false)
  })

  it("hands the current viewer to the draft registry at install and on every change", () => {
    useAuthStore.getState().setSession({ user: USER_A })
    teardown = installViewerScope(qc)
    expect(adoptViewer).toHaveBeenLastCalledWith(USER_A.id)

    teardown()
    useAuthStore.getState().clear()
    expect(adoptViewer).toHaveBeenCalledTimes(1)
  })
})
