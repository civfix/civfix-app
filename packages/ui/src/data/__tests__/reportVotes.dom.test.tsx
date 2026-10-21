import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import type { ReportConfirmResponse, ReportDTO } from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"
import { ApiProvider } from "../context"
import { makeFakeDataContext } from "../fakes"
import { queryKeys } from "../keys"
import {
  useConfirmMatch,
  useConfirmReport,
  useMarkReportFixed,
  useUnconfirmReport,
  useUnmarkReportFixed,
} from "../hooks/reports"

type Votes = [confirmCount: number, confirmedByMe: boolean, fixedCount: number, fixedByMe: boolean]

const CODE = ["report", "LA-7Q2K"] as const

function held<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const votes = ([confirmCount, confirmedByMe, fixedCount, fixedByMe]: Votes): ReportConfirmResponse => ({
  confirmCount,
  confirmedByMe,
  fixedCount,
  fixedByMe,
})

function report(state: Votes): ReportDTO {
  return {
    id: "r1",
    referenceCode: "LA-7Q2K",
    category: "trash",
    status: "published",
    visibility: "public",
    title: "Overflowing bin",
    mine: false,
    ...votes(state),
  } as unknown as ReportDTO
}

function renderWithApi<T>(useHook: () => T, api: Record<string, unknown>, cached: ReportDTO) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(queryKeys.report("r1"), cached)
  const context = makeFakeDataContext({ api: api as unknown as ApiClient })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={context}>{children}</ApiProvider>
    </QueryClientProvider>
  )
  return { ...renderHook(useHook, { wrapper }), queryClient }
}

function stateOf(qc: QueryClient, key: readonly unknown[] = queryKeys.report("r1")): ReportConfirmResponse {
  const r = qc.getQueryData<ReportDTO>(key)
  return { confirmCount: r!.confirmCount, confirmedByMe: r!.confirmedByMe, fixedCount: r!.fixedCount, fixedByMe: r!.fixedByMe }
}

// Every vote endpoint, each holding its call open, so a test sees the pending state and counts the calls.
function pendingApi() {
  const call = held<ReportConfirmResponse>()
  const api = {
    confirmReport: vi.fn(() => call.promise),
    unconfirmReport: vi.fn(() => call.promise),
    markReportFixed: vi.fn(() => call.promise),
    unmarkReportFixed: vi.fn(() => call.promise),
  }
  return { api, call }
}

function callsMade(api: Record<string, ReturnType<typeof vi.fn>>): number {
  return Object.values(api).reduce((n, fn) => n + fn.mock.calls.length, 0)
}

describe("GH#203 vote hooks", () => {
  it("T7: useConfirmReport moves a fixed vote to a confirmation at once, in one call", async () => {
    const { api } = pendingApi()
    const { result, queryClient } = renderWithApi(() => useConfirmReport("r1"), api, report([3, false, 1, true]))
    act(() => result.current.mutate())
    await waitFor(() => expect(api.confirmReport).toHaveBeenCalledTimes(1))
    expect(stateOf(queryClient)).toEqual(votes([4, true, 0, false]))
    expect(api.confirmReport).toHaveBeenCalledWith({ id: "r1" })
    expect(callsMade(api)).toBe(1)
    expect(api.unmarkReportFixed).not.toHaveBeenCalled()
  })

  it("T8: useMarkReportFixed moves a confirmation to a fixed vote at once, in one call", async () => {
    const { api } = pendingApi()
    const { result, queryClient } = renderWithApi(() => useMarkReportFixed("r1"), api, report([3, true, 1, false]))
    act(() => result.current.mutate())
    await waitFor(() => expect(api.markReportFixed).toHaveBeenCalledTimes(1))
    expect(stateOf(queryClient)).toEqual(votes([2, false, 2, true]))
    expect(api.markReportFixed).toHaveBeenCalledWith({ id: "r1" })
    expect(callsMade(api)).toBe(1)
    expect(api.unconfirmReport).not.toHaveBeenCalled()
  })

  it("T9: useMarkReportFixed adds a fixed vote at once when there was no vote", async () => {
    const { api } = pendingApi()
    const { result, queryClient } = renderWithApi(() => useMarkReportFixed("r1"), api, report([3, false, 1, false]))
    act(() => result.current.mutate())
    await waitFor(() => expect(api.markReportFixed).toHaveBeenCalledTimes(1))
    expect(stateOf(queryClient)).toEqual(votes([3, false, 2, true]))
  })

  it("T10: useUnmarkReportFixed removes the fixed vote at once, in one call", async () => {
    const { api } = pendingApi()
    const { result, queryClient } = renderWithApi(() => useUnmarkReportFixed("r1"), api, report([3, false, 2, true]))
    act(() => result.current.mutate())
    await waitFor(() => expect(api.unmarkReportFixed).toHaveBeenCalledTimes(1))
    expect(stateOf(queryClient)).toEqual(votes([3, false, 1, false]))
    expect(api.unmarkReportFixed).toHaveBeenCalledWith({ id: "r1" })
    expect(callsMade(api)).toBe(1)
  })

  it("T11: useUnconfirmReport removes the confirmation at once", async () => {
    const { api } = pendingApi()
    const { result, queryClient } = renderWithApi(() => useUnconfirmReport("r1"), api, report([3, true, 1, false]))
    act(() => result.current.mutate())
    await waitFor(() => expect(api.unconfirmReport).toHaveBeenCalledTimes(1))
    expect(stateOf(queryClient)).toEqual(votes([2, false, 1, false]))
  })

  it("T12: useMarkReportFixed takes the four fields the API answers, leaving the rest of the report alone", async () => {
    const { api, call } = pendingApi()
    const before = report([3, true, 1, false])
    const { result, queryClient } = renderWithApi(() => useMarkReportFixed("r1"), api, before)
    act(() => result.current.mutate())
    await waitFor(() => expect(api.markReportFixed).toHaveBeenCalledTimes(1))
    await act(async () => call.resolve(votes([5, false, 2, true])))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(queryKeys.report("r1"))).toEqual({ ...before, ...votes([5, false, 2, true]) })
  })

  it("T13: useMarkReportFixed rolls back when the API fails", async () => {
    const { api, call } = pendingApi()
    const { result, queryClient } = renderWithApi(() => useMarkReportFixed("r1"), api, report([3, true, 1, false]))
    act(() => result.current.mutate())
    await waitFor(() => expect(api.markReportFixed).toHaveBeenCalledTimes(1))
    await act(async () => call.reject(new TypeError("Network request failed")))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(stateOf(queryClient)).toEqual(votes([3, true, 1, false]))
  })

  it("T14: useMarkReportFixed presses and rolls back the report cached under its reference code", async () => {
    const { api, call } = pendingApi()
    const { result, queryClient } = renderWithApi(() => useMarkReportFixed("r1"), api, report([3, true, 1, false]))
    queryClient.setQueryData(CODE, report([3, true, 1, false]))
    act(() => result.current.mutate())
    await waitFor(() => expect(api.markReportFixed).toHaveBeenCalledTimes(1))
    expect(stateOf(queryClient, CODE)).toEqual(votes([2, false, 2, true]))
    await act(async () => call.reject(new TypeError("Network request failed")))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(stateOf(queryClient, CODE)).toEqual(votes([3, true, 1, false]))
  })

  it("T15: sends This is fixed then I see this too in tap order, and the earlier answer never undoes the later tap", async () => {
    const fixed = held<ReportConfirmResponse>()
    const confirm = held<ReportConfirmResponse>()
    const order: string[] = []
    const api = {
      markReportFixed: vi.fn(() => {
        order.push("markReportFixed")
        return fixed.promise
      }),
      confirmReport: vi.fn(() => {
        order.push("confirmReport")
        return confirm.promise
      }),
    }
    const { result, queryClient } = renderWithApi(
      () => ({ fixed: useMarkReportFixed("r1"), confirm: useConfirmReport("r1") }),
      api,
      report([3, false, 1, false]),
    )
    act(() => {
      result.current.fixed.mutate()
      result.current.confirm.mutate()
    })
    await waitFor(() => expect(api.markReportFixed).toHaveBeenCalledTimes(1))

    await act(async () => fixed.resolve(votes([3, false, 2, true])))
    await waitFor(() => expect(api.confirmReport).toHaveBeenCalledTimes(1))
    expect(order).toEqual(["markReportFixed", "confirmReport"])
    expect(stateOf(queryClient)).toEqual(votes([4, true, 1, false]))

    await act(async () => confirm.resolve(votes([4, true, 1, false])))
    await waitFor(() => expect(queryClient.isMutating()).toBe(0))
    expect(stateOf(queryClient)).toEqual(votes([4, true, 1, false]))
  })

  it("T17: useConfirmMatch takes the four fields the API answers", async () => {
    const api = { confirmReport: vi.fn(async () => votes([4, true, 0, false])) }
    const { result, queryClient } = renderWithApi(() => useConfirmMatch(), api, report([3, false, 1, true]))
    await act(async () => {
      await result.current.mutateAsync("r1")
    })
    expect(stateOf(queryClient)).toEqual(votes([4, true, 0, false]))
  })
})
