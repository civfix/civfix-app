import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { AppError, ErrorCode, type ReportConfirmResponse, type ReportDTO } from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"
import { ApiProvider, useReport } from "../../data"
import { makeFakeDataContext } from "../../data/fakes"
import { queryKeys } from "../../data/keys"
import { I18nProvider } from "../../i18n"
import { pathForEntry } from "../../nav"
import { ToastContext } from "../../primitives/toastContext"
import { useReportMeToo } from "../reportDetail/useReportMeToo"

function report(over: Partial<ReportDTO>): ReportDTO {
  return {
    id: "r1",
    referenceCode: "LA-7Q2K",
    category: "trash",
    status: "published",
    visibility: "public",
    title: "Overflowing bin",
    mine: false,
    confirmCount: 4,
    confirmedByMe: false,
    ...over,
  } as unknown as ReportDTO
}

// The page reads the report from its cache, so the hook is driven the way ReportDetailContent drives it.
function renderMeToo(
  cached: ReportDTO,
  api: Record<string, unknown>,
  requireAuth: (action: () => void, opts?: { next?: string }) => void = (action) => action(),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
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
  return { ...hook, toast }
}

const answer = (confirmCount: number, confirmedByMe: boolean): ReportConfirmResponse => ({
  confirmCount,
  confirmedByMe,
  fixedCount: 0,
  fixedByMe: false,
})

describe("useReportMeToo", () => {
  it("presses I see this too and adds one at once, then undoes both on a second tap", async () => {
    const api = {
      confirmReport: vi.fn(async () => answer(5, true)),
      unconfirmReport: vi.fn(async () => answer(4, false)),
    }
    const { result } = renderMeToo(report({}), api)
    expect(result.current).toMatchObject({
      visible: true,
      seen: { pressed: false },
      confirmCount: 4,
    })

    act(() => result.current.seen.onPress())
    await waitFor(() =>
      expect(result.current).toMatchObject({ seen: { pressed: true }, confirmCount: 5 }),
    )
    expect(api.confirmReport).toHaveBeenCalledWith({ id: "r1" })

    act(() => result.current.seen.onPress())
    await waitFor(() =>
      expect(result.current).toMatchObject({ seen: { pressed: false }, confirmCount: 4 }),
    )
    expect(api.unconfirmReport).toHaveBeenCalledWith({ id: "r1" })
  })

  it("rolls back and shows the error when the call fails", async () => {
    let fail!: (err: unknown) => void
    const api = {
      confirmReport: vi.fn(
        () => new Promise<ReportConfirmResponse>((_resolve, reject) => (fail = reject)),
      ),
    }
    const { result, toast } = renderMeToo(report({}), api)
    act(() => result.current.seen.onPress())
    await waitFor(() =>
      expect(result.current).toMatchObject({ seen: { pressed: true }, confirmCount: 5 }),
    )
    await act(async () => fail(new AppError(ErrorCode.INTERNAL, "boom")))
    await waitFor(() =>
      expect(result.current).toMatchObject({ seen: { pressed: false }, confirmCount: 4 }),
    )
    expect(toast.show).toHaveBeenCalledWith("Couldn't save your vote. Try again.", {
      variant: "error",
    })
  })

  it("asks a guest to sign in and brings them back to the report, without calling the API", () => {
    const api = { confirmReport: vi.fn() }
    const requireAuth = vi.fn()
    const { result } = renderMeToo(report({}), api, requireAuth)
    act(() => result.current.seen.onPress())
    expect(requireAuth).toHaveBeenCalledWith(expect.any(Function), {
      next: pathForEntry({ kind: "pin", id: "LA-7Q2K" }),
    })
    expect(api.confirmReport).not.toHaveBeenCalled()
  })

  it("gives the reporter and a resolved report the counts but no buttons", () => {
    expect(renderMeToo(report({ mine: true }), {}).result.current).toMatchObject({
      visible: false,
      confirmCount: 4,
    })
    expect(
      renderMeToo(report({ status: "resolved", confirmedByMe: true }), {}).result.current,
    ).toMatchObject({ visible: false, confirmCount: 4 })
  })
})
