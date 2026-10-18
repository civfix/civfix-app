import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { AppError, ErrorCode, type ReportConfirmResponse, type ReportDTO } from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"
import { ApiProvider } from "../context"
import { makeFakeDataContext } from "../fakes"
import { queryKeys } from "../keys"
import { useConfirmReport, useUnconfirmReport } from "../hooks/reports"

function held<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function report(over: Partial<ReportDTO>): ReportDTO {
  return {
    id: "r1",
    category: "trash",
    status: "published",
    visibility: "public",
    title: "Overflowing bin",
    mine: false,
    confirmCount: 0,
    confirmedByMe: false,
    ...over,
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

const confirmState = (qc: QueryClient) => {
  const r = qc.getQueryData<ReportDTO>(queryKeys.report("r1"))
  return { confirmCount: r?.confirmCount, confirmedByMe: r?.confirmedByMe }
}

describe("useConfirmReport", () => {
  it("T1: presses at once, before the API answers", async () => {
    const call = held<ReportConfirmResponse>()
    const api = { confirmReport: vi.fn(() => call.promise) }
    const { result, queryClient } = renderWithApi(
      () => useConfirmReport("r1"),
      api,
      report({ confirmCount: 4, confirmedByMe: false }),
    )
    act(() => result.current.mutate())
    await waitFor(() => expect(api.confirmReport).toHaveBeenCalledTimes(1))
    expect(api.confirmReport).toHaveBeenCalledWith({ id: "r1" })
    expect(confirmState(queryClient)).toEqual({ confirmCount: 5, confirmedByMe: true })
  })

  it("T2: takes the server's count once it answers, leaving the rest of the report alone", async () => {
    const call = held<ReportConfirmResponse>()
    const api = { confirmReport: vi.fn(() => call.promise) }
    const before = report({ confirmCount: 4, confirmedByMe: false })
    const { result, queryClient } = renderWithApi(() => useConfirmReport("r1"), api, before)
    act(() => result.current.mutate())
    await waitFor(() => expect(api.confirmReport).toHaveBeenCalledTimes(1))
    await act(async () => call.resolve({ confirmCount: 7, confirmedByMe: true }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(queryKeys.report("r1"))).toEqual({
      ...before,
      confirmCount: 7,
      confirmedByMe: true,
    })
  })

  it("T3: rolls back when the API fails, and calls onError once", async () => {
    const call = held<ReportConfirmResponse>()
    const api = { confirmReport: vi.fn(() => call.promise) }
    const { result, queryClient } = renderWithApi(
      () => useConfirmReport("r1"),
      api,
      report({ confirmCount: 4, confirmedByMe: false }),
    )
    const onError = vi.fn()
    act(() => result.current.mutate(undefined, { onError }))
    await waitFor(() => expect(confirmState(queryClient)).toEqual({ confirmCount: 5, confirmedByMe: true }))
    await act(async () => call.reject(new AppError(ErrorCode.INTERNAL, "boom")))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(confirmState(queryClient)).toEqual({ confirmCount: 4, confirmedByMe: false })
    expect(onError).toHaveBeenCalledTimes(1)
  })
})

describe("useUnconfirmReport", () => {
  it("T4: releases at once, before the API answers", async () => {
    const call = held<ReportConfirmResponse>()
    const api = { unconfirmReport: vi.fn(() => call.promise) }
    const { result, queryClient } = renderWithApi(
      () => useUnconfirmReport("r1"),
      api,
      report({ confirmCount: 5, confirmedByMe: true }),
    )
    act(() => result.current.mutate())
    await waitFor(() => expect(api.unconfirmReport).toHaveBeenCalledTimes(1))
    expect(api.unconfirmReport).toHaveBeenCalledWith({ id: "r1" })
    expect(confirmState(queryClient)).toEqual({ confirmCount: 4, confirmedByMe: false })
  })

  it("T5: rolls back when the API fails, and calls onError once", async () => {
    const call = held<ReportConfirmResponse>()
    const api = { unconfirmReport: vi.fn(() => call.promise) }
    const { result, queryClient } = renderWithApi(
      () => useUnconfirmReport("r1"),
      api,
      report({ confirmCount: 5, confirmedByMe: true }),
    )
    const onError = vi.fn()
    act(() => result.current.mutate(undefined, { onError }))
    await waitFor(() => expect(confirmState(queryClient)).toEqual({ confirmCount: 4, confirmedByMe: false }))
    await act(async () => call.reject(new AppError(ErrorCode.INTERNAL, "boom")))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(confirmState(queryClient)).toEqual({ confirmCount: 5, confirmedByMe: true })
    expect(onError).toHaveBeenCalledTimes(1)
  })
})

describe("useConfirmReport and useUnconfirmReport", () => {
  it.each([
    ["useConfirmReport", () => useConfirmReport("r1"), false],
    ["useUnconfirmReport", () => useUnconfirmReport("r1"), true],
  ] as const)("T6: %s invalidates the cached map and nearby queries once settled, and no post", async (_name, useHook, confirmedByMe) => {
    const answer: ReportConfirmResponse = { confirmCount: confirmedByMe ? 4 : 5, confirmedByMe: !confirmedByMe }
    const api = {
      confirmReport: vi.fn(async () => answer),
      unconfirmReport: vi.fn(async () => answer),
    }
    const { result, queryClient } = renderWithApi(useHook, api, report({ confirmCount: 4, confirmedByMe }))
    const map = queryKeys.mapReports({ west: -118.4, south: 34, east: -118.2, north: 34.2 }, [])
    const nearby = queryKeys.nearbyReports(34.1, -118.3, 0.25)
    const post = ["post", "p1"] as const
    queryClient.setQueryData(map, { pins: [] })
    queryClient.setQueryData(nearby, { pins: [] })
    queryClient.setQueryData(post, { id: "p1" })
    await act(async () => {
      await result.current.mutateAsync()
    })
    await waitFor(() => expect(queryClient.getQueryState(map)?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(nearby)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(post)?.isInvalidated).toBe(false)
  })
})

describe("Me too on a report opened by its reference code", () => {
  const CODE = ["report", "LA-7Q2K"] as const

  it("presses the page cached under the code, and takes the server's count", async () => {
    const call = held<ReportConfirmResponse>()
    const api = { confirmReport: vi.fn(() => call.promise) }
    const { result, queryClient } = renderWithApi(
      () => useConfirmReport("r1"),
      api,
      report({ confirmCount: 4, confirmedByMe: false }),
    )
    queryClient.setQueryData(CODE, report({ confirmCount: 4, confirmedByMe: false }))
    queryClient.setQueryData(["report", "LA-OTHER"], report({ id: "r2", confirmCount: 4 }))
    act(() => result.current.mutate())
    await waitFor(() => expect(queryClient.getQueryData<ReportDTO>(CODE)?.confirmCount).toBe(5))
    expect(queryClient.getQueryData<ReportDTO>(CODE)?.confirmedByMe).toBe(true)
    await act(async () => call.resolve({ confirmCount: 9, confirmedByMe: true }))
    await waitFor(() => expect(queryClient.getQueryData<ReportDTO>(CODE)?.confirmCount).toBe(9))
    expect(queryClient.getQueryData<ReportDTO>(["report", "LA-OTHER"])?.confirmCount).toBe(4)
  })

  it("rolls the page cached under the code back when the API fails", async () => {
    const call = held<ReportConfirmResponse>()
    const api = { unconfirmReport: vi.fn(() => call.promise) }
    const { result, queryClient } = renderWithApi(
      () => useUnconfirmReport("r1"),
      api,
      report({ confirmCount: 5, confirmedByMe: true }),
    )
    queryClient.setQueryData(CODE, report({ confirmCount: 5, confirmedByMe: true }))
    act(() => result.current.mutate())
    await waitFor(() => expect(queryClient.getQueryData<ReportDTO>(CODE)?.confirmedByMe).toBe(false))
    await act(async () => call.reject(new AppError(ErrorCode.INTERNAL, "boom")))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(queryClient.getQueryData<ReportDTO>(CODE)).toMatchObject({ confirmCount: 5, confirmedByMe: true })
  })
})
