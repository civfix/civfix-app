/**
 * What WebDataProvider gives the shared UI. The report create is DataContextValue.submitReport, the
 * boundary the shared wizard calls. Filing a report needs an account, so a signed-out submit goes
 * through the authed create and fails there, never through the anonymous endpoint.
 */
import * as React from "react"
import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AppError, ErrorCode, type ReportDTO, type UserDTO } from "@civfix/contract"
import type { DataContextValue, ReportSubmission } from "@civfix/ui/data"

const calls = vi.hoisted(() => ({
  api: [] as string[],
  createReport: undefined as undefined | ((body: unknown) => Promise<unknown>),
  provided: null as DataContextValue | null,
}))
const runTurnstile = vi.hoisted(() => vi.fn<(action?: string) => Promise<string>>())
const saveClaimHandoff = vi.hoisted(() => vi.fn())
const toCreateReportRequest = vi.hoisted(() =>
  vi.fn((s: { idempotencyKey: string; lat: number; lng: number }) => ({
    idempotencyKey: s.idempotencyKey,
    lat: s.lat,
    lng: s.lng,
    mapped: true,
  })),
)

// Records every api method the provider invokes, so "only createReport" also proves no other create ran.
vi.mock("@/lib/api", () => ({
  api: new Proxy(
    {},
    {
      get: (_target, name) =>
        typeof name !== "string" || name === "then"
          ? undefined
          : (...args: unknown[]) => {
              calls.api.push(name)
              if (name === "createReport" && calls.createReport) return calls.createReport(args[0])
              return Promise.reject(new Error(`unexpected api.${name}`))
            },
    },
  ),
}))
vi.mock("@/lib/turnstile", () => ({ runTurnstile, TURNSTILE_SITEKEY: "" }))
vi.mock("@/store/claim-handoff", () => ({ saveClaimHandoff }))

vi.mock("@civfix/ui", () => ({
  toCreateReportRequest,
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  setSourceCommit: () => {},
  setWebOrigin: () => {},
}))
vi.mock("@civfix/ui/data", () => ({
  ApiProvider: ({ value, children }: { value: DataContextValue; children: React.ReactNode }) => {
    calls.provided = value
    return <>{children}</>
  },
  normalizeAuthState: (s: unknown) => s,
}))
vi.mock("@civfix/ui/i18n", () => ({ I18nProvider: () => null, FALLBACK_LOCALE: "en", useLocale: () => ({}) }))
vi.mock("@civfix/ui/theme", () => ({
  ThemeProvider: () => null,
  setAppearancePreferenceStore: () => {},
  useColorSchemeName: () => "light",
}))
vi.mock("@civfix/ui/capabilities", () => ({
  CapabilitiesProvider: () => null,
  makeFakeCapabilities: () => ({}),
  webClipboardCapability: {},
}))
vi.mock("@civfix/tokens", () => ({ colorSchemes: {} }))
vi.mock("@/lib/query", () => ({ makeQueryClient: () => null }))
vi.mock("@/lib/query-persist", () => ({ restorePersistedCache: () => {}, installCachePersistenceWriter: () => {} }))
vi.mock("@/lib/viewer-scope", () => ({ installViewerScope: () => {} }))
vi.mock("@/lib/ws", () => ({ chatSocket: {} }))
vi.mock("@/lib/web-camera", () => ({ webCamera: {} }))
vi.mock("@/lib/web-geolocation", () => ({ webGeolocation: {} }))
vi.mock("@/lib/carto", () => ({ CARTO_API_KEY: undefined }))
vi.mock("@/lib/locale", () => ({ useResolvedLocale: () => ({}) }))
vi.mock("@/store/appearance-store", () => ({ useAppearanceStore: () => "system" }))
vi.mock("@/hooks/use-auth", () => ({ useLogout: () => () => {} }))
vi.mock("@/components/auth/auth-hydrator", () => ({ AuthHydrator: () => null }))
vi.mock("@/components/auth/sign-out-failure-notice", () => ({ SignOutFailureNotice: () => null }))
vi.mock("@/components/boot-splash", () => ({ BootSplash: () => null }))
vi.mock("@/components/realtime/realtime-channel", () => ({ RealtimeChannel: () => null }))
vi.mock("@/features/auth/first-run-gate", () => ({ FirstRunGate: () => null }))
vi.mock("@/components/home/web-internal-href", () => ({ webOpenInternalHref: () => {} }))

const { WebDataProvider } = await import("./providers")
const { useAuthStore } = await import("@/store/auth-store")
const { useUiStore } = await import("@/store/ui-store")

const USER: UserDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Ada",
  role: "citizen",
  locale: "en",
  createdAt: "2026-01-01T00:00:00.000Z",
}

const SUBMISSION: ReportSubmission = {
  idempotencyKey: "22222222-2222-4222-8222-222222222222",
  category: "hazard",
  type: "pavement",
  lat: 34.09,
  lng: -118.28,
  geomSource: "device",
  mediaUploadIds: ["33333333-3333-4333-8333-333333333333"],
  title: "Pothole on Sunset",
}

function provided(): DataContextValue {
  render(
    <WebDataProvider>
      <span />
    </WebDataProvider>,
  )
  if (!calls.provided) throw new Error("WebDataProvider provided no value")
  return calls.provided
}

beforeEach(() => {
  calls.api = []
  calls.createReport = undefined
  calls.provided = null
  runTurnstile.mockReset().mockResolvedValue("turnstile-token")
  saveClaimHandoff.mockReset()
  toCreateReportRequest.mockClear()
})

afterEach(() => {
  act(() => useAuthStore.setState({ status: "idle", user: null, csrfToken: null, optimistic: false }))
  act(() => useUiStore.setState({ authModalOpen: false, authModalReturnPath: null }))
})

describe("WebDataProvider submitReport", () => {
  it("T1: signed in, creates the report through the authed endpoint with an empty honeypot", async () => {
    useAuthStore.setState({ status: "authenticated", user: USER, csrfToken: "csrf", optimistic: false })
    const createReport = vi.fn(async () => ({
      id: "report-1",
      lat: 34.09,
      lng: -118.28,
      category: "hazard",
      status: "published",
    }) as unknown as ReportDTO)
    calls.createReport = createReport

    const result = await provided().submitReport!(SUBMISSION)

    expect(createReport).toHaveBeenCalledTimes(1)
    expect(createReport).toHaveBeenCalledWith({ ...toCreateReportRequest(SUBMISSION), honeypot: "" })
    expect(calls.api).toEqual(["createReport"])
    expect(result).not.toHaveProperty("claimCode")
    expect(result).toEqual({
      reportId: "report-1",
      lat: 34.09,
      lng: -118.28,
      category: "hazard",
      status: "published",
    })
  })

  it("T2: signed out, the submit goes through the authed path and the server's 401 reaches the caller", async () => {
    useAuthStore.setState({ status: "anonymous", user: null, csrfToken: null, optimistic: false })
    const unauthorized = AppError.unauthorized()
    calls.createReport = vi.fn(async () => {
      throw unauthorized
    })

    const submit = provided().submitReport!(SUBMISSION)

    await expect(submit).rejects.toBe(unauthorized)
    expect(unauthorized.code).toBe(ErrorCode.UNAUTHORIZED)
    expect(calls.api).toEqual(["createReport"])
    expect(runTurnstile).not.toHaveBeenCalled()
    expect(saveClaimHandoff).not.toHaveBeenCalled()
  })
})

describe("WebDataProvider requireAuth", () => {
  it("opens the auth modal with the gated action's return path for a signed-out viewer", () => {
    useAuthStore.setState({ status: "anonymous", user: null, csrfToken: null, optimistic: false })
    const action = vi.fn()

    const { requireAuth } = provided()
    act(() => requireAuth(action, { next: "/report" }))

    expect(action).not.toHaveBeenCalled()
    expect(useUiStore.getState()).toMatchObject({ authModalOpen: true, authModalReturnPath: "/report" })
  })

  it("runs the action for a signed-in viewer without opening the modal", () => {
    useAuthStore.setState({ status: "authenticated", user: USER, csrfToken: "csrf", optimistic: false })
    const action = vi.fn()

    const { requireAuth } = provided()
    act(() => requireAuth(action, { next: "/report" }))

    expect(action).toHaveBeenCalledTimes(1)
    expect(useUiStore.getState().authModalOpen).toBe(false)
  })
})
