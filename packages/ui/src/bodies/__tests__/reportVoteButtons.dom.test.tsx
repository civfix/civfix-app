import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import type { ReportConfirmResponse, ReportDTO, ReportStatus } from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"
import { ApiProvider, useReport } from "../../data"
import { makeFakeDataContext } from "../../data/fakes"
import { queryKeys } from "../../data/keys"
import { I18nProvider } from "../../i18n"
import { pathForEntry } from "../../nav"
import { ToastContext } from "../../primitives/toastContext"
import { canMeToo, useReportMeToo } from "../reportDetail/useReportMeToo"

type Votes = [confirmCount: number, confirmedByMe: boolean, fixedCount: number, fixedByMe: boolean]

const votes = ([confirmCount, confirmedByMe, fixedCount, fixedByMe]: Votes): ReportConfirmResponse => ({
  confirmCount,
  confirmedByMe,
  fixedCount,
  fixedByMe,
})

function report(state: Votes, over: Partial<ReportDTO> = {}): ReportDTO {
  return {
    id: "r1",
    referenceCode: "LA-7Q2K",
    category: "trash",
    status: "published",
    visibility: "public",
    title: "Overflowing bin",
    mine: false,
    ...votes(state),
    ...over,
  } as unknown as ReportDTO
}

const API_METHODS = ["confirmReport", "unconfirmReport", "markReportFixed", "unmarkReportFixed"] as const

// Every vote endpoint answers with `answer` (or rejects), so a test can tell which one a press called.
function voteApi(answer: () => Promise<ReportConfirmResponse>) {
  return Object.fromEntries(API_METHODS.map((m) => [m, vi.fn(answer)])) as Record<
    (typeof API_METHODS)[number],
    ReturnType<typeof vi.fn>
  >
}

const callsMade = (api: Record<string, ReturnType<typeof vi.fn>>) =>
  Object.values(api).reduce((n, fn) => n + fn.mock.calls.length, 0)

// The page reads the report from its cache, so the hook is driven the way ReportDetailContent drives it.
function renderVotes(
  cached: ReportDTO,
  api: Record<string, unknown>,
  requireAuth: (action: () => void, opts?: { next?: string }) => void = (action) => action(),
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  queryClient.setQueryData(queryKeys.report(cached.id), cached)
  const context = makeFakeDataContext({ api: api as unknown as ApiClient, requireAuth })
  const toast = { show: vi.fn() }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={context}>
        <I18nProvider locale="en">
          <ToastContext.Provider value={toast}>{children}</ToastContext.Provider>
        </I18nProvider>
      </ApiProvider>
    </QueryClientProvider>
  )
  const hook = renderHook(
    () => {
      const shown = useReport(cached.id).data ?? cached
      return useReportMeToo(shown)
    },
    { wrapper },
  )
  return { ...hook, toast, queryClient }
}

describe("GH#203 the report page's two buttons", () => {
  it("T18: This is fixed sends one markReportFixed and shows This is fixed pressed", async () => {
    const api = voteApi(async () => votes([3, false, 2, true]))
    const { result, queryClient } = renderVotes(report([3, false, 1, false]), api)
    act(() => result.current.fixed.onPress())
    await waitFor(() => expect(queryClient.isMutating()).toBe(0))
    expect(api.markReportFixed).toHaveBeenCalledWith({ id: "r1" })
    expect(callsMade(api)).toBe(1)
    expect(result.current.fixed.pressed).toBe(true)
    expect(result.current.seen.pressed).toBe(false)
  })

  it("T19: This is fixed over a confirmation sends one markReportFixed and no unconfirmReport", async () => {
    const api = voteApi(async () => votes([2, false, 2, true]))
    const { result, queryClient } = renderVotes(report([3, true, 1, false]), api)
    act(() => result.current.fixed.onPress())
    await waitFor(() => expect(queryClient.isMutating()).toBe(0))
    expect(api.markReportFixed).toHaveBeenCalledTimes(1)
    expect(api.unconfirmReport).not.toHaveBeenCalled()
    expect(callsMade(api)).toBe(1)
  })

  it("T20: This is fixed when pressed sends one unmarkReportFixed", async () => {
    const api = voteApi(async () => votes([3, false, 1, false]))
    const { result, queryClient } = renderVotes(report([3, false, 2, true]), api)
    act(() => result.current.fixed.onPress())
    await waitFor(() => expect(queryClient.isMutating()).toBe(0))
    expect(api.unmarkReportFixed).toHaveBeenCalledTimes(1)
    expect(callsMade(api)).toBe(1)
  })

  it("T21: I see this too over a fixed vote sends one confirmReport and no unmarkReportFixed", async () => {
    const api = voteApi(async () => votes([4, true, 1, false]))
    const { result, queryClient } = renderVotes(report([3, false, 2, true]), api)
    act(() => result.current.seen.onPress())
    await waitFor(() => expect(queryClient.isMutating()).toBe(0))
    expect(api.confirmReport).toHaveBeenCalledTimes(1)
    expect(api.unmarkReportFixed).not.toHaveBeenCalled()
    expect(callsMade(api)).toBe(1)
  })

  it.each(["seen", "fixed"] as const)("T22: a failed %s press shows the error once and rolls back", async (button) => {
    const api = voteApi(async () => Promise.reject(new TypeError("Network request failed")))
    const before = report([3, false, 1, false])
    const { result, toast, queryClient } = renderVotes(before, api)
    act(() => result.current[button].onPress())
    await waitFor(() => expect(toast.show).toHaveBeenCalledTimes(1))
    expect(toast.show).toHaveBeenCalledWith("Couldn't save your vote. Try again.", { variant: "error" })
    await waitFor(() => expect(queryClient.isMutating()).toBe(0))
    expect(queryClient.getQueryData(queryKeys.report("r1"))).toEqual(before)
  })

  it.each(["seen", "fixed"] as const)("T23: a guest's %s press asks them to sign in and back to the report", (button) => {
    const api = voteApi(async () => votes([0, false, 0, false]))
    const requireAuth = vi.fn()
    const { result } = renderVotes(report([3, false, 1, false]), api, requireAuth)
    act(() => result.current[button].onPress())
    expect(requireAuth).toHaveBeenCalledWith(expect.any(Function), {
      next: pathForEntry({ kind: "pin", id: "LA-7Q2K" }),
    })
    expect(callsMade(api)).toBe(0)
  })
})

describe("GH#203 canMeToo gates both buttons", () => {
  it.each<ReportStatus>(["published", "acknowledged", "in_progress"])("T24: true on someone else's %s report", (status) => {
    expect(canMeToo(report([0, false, 0, false], { mine: false, status }))).toBe(true)
  })

  it("T24: false on the reporter's own report", () => {
    expect(canMeToo(report([0, false, 0, false], { mine: true, status: "published" }))).toBe(false)
  })

  it("T24: false on a resolved report, even one marked fixed", () => {
    expect(canMeToo(report([0, false, 1, true], { mine: false, status: "resolved" }))).toBe(false)
  })
})
