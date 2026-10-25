import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AppConfigResponse } from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"
import { ApiProvider } from "../../context"
import { makeFakeDataContext } from "../../fakes"
import { queryKeys, useAppConfig } from "../../index"

const CONFIG: AppConfigResponse = {
  minAppVersion: { ios: null, android: "1.5.0" },
  storeUrl: { ios: null, android: "https://play.google.com/store/apps/details?id=org.civfix.community" },
  announcement: null,
}

const T0 = new Date("2026-10-25T12:00:00.000Z").getTime()

function renderWithApi(getAppConfig: () => Promise<AppConfigResponse>, queryClient = new QueryClient()) {
  const context = makeFakeDataContext({ api: { getAppConfig } as unknown as ApiClient })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={context}>{children}</ApiProvider>
    </QueryClientProvider>
  )
  return { ...renderHook(() => useAppConfig(), { wrapper }), queryClient }
}

function regainFocusAt(ms: number): void {
  vi.setSystemTime(T0 + ms)
  act(() => {
    focusManager.setFocused(false)
    focusManager.setFocused(true)
  })
}

describe("useAppConfig", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(T0)
  })

  afterEach(() => {
    focusManager.setFocused(undefined)
    vi.useRealTimers()
  })

  it("T18: reads getAppConfig once under queryKeys.appConfig and returns the response", async () => {
    const getAppConfig = vi.fn(async () => CONFIG)
    const { result, queryClient } = renderWithApi(getAppConfig)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getAppConfig).toHaveBeenCalledTimes(1)
    expect(result.current.data).toEqual(CONFIG)
    expect(queryKeys.appConfig).toEqual(["app-config"])
    expect(queryClient.getQueryCache().getAll().map((q) => q.queryKey)).toEqual([queryKeys.appConfig])
  })

  it("T19: a return to the foreground within five minutes does not refetch", async () => {
    const getAppConfig = vi.fn(async () => CONFIG)
    const { result } = renderWithApi(getAppConfig)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    regainFocusAt(4 * 60_000 + 59_000)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(getAppConfig).toHaveBeenCalledTimes(1)
  })

  it("T20: a return to the foreground after five minutes refetches", async () => {
    const getAppConfig = vi.fn(async () => CONFIG)
    const { result } = renderWithApi(getAppConfig)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    regainFocusAt(5 * 60_000 + 1_000)
    await waitFor(() => expect(getAppConfig).toHaveBeenCalledTimes(2))
  })

  it("T21: a failed request leaves the hook errored with no data", async () => {
    const getAppConfig = vi.fn(async (): Promise<AppConfigResponse> => {
      throw new TypeError("Network request failed")
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderWithApi(getAppConfig, queryClient)
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  it("T22: invalidating queryKeys.appConfig, as sign-in does, refetches at once", async () => {
    const getAppConfig = vi.fn(async () => CONFIG)
    const { result, queryClient } = renderWithApi(getAppConfig)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.appConfig })
    })
    expect(getAppConfig).toHaveBeenCalledTimes(2)
  })

  it("T23: after queryClient.clear(), as sign-out does, the next render refetches and drops the old response", async () => {
    const overridden: AppConfigResponse = { ...CONFIG, minAppVersion: { ios: "999.0.0", android: "999.0.0" } }
    let respond: (config: AppConfigResponse) => void = () => undefined
    const getAppConfig = vi
      .fn<() => Promise<AppConfigResponse>>()
      .mockResolvedValueOnce(overridden)
      .mockImplementationOnce(() => new Promise((resolve) => (respond = resolve)))
    const { result, queryClient, rerender } = renderWithApi(getAppConfig)
    await waitFor(() => expect(result.current.data).toEqual(overridden))
    act(() => queryClient.clear())
    rerender()
    await waitFor(() => expect(getAppConfig).toHaveBeenCalledTimes(2))
    expect(result.current.data).toBeUndefined()
    act(() => respond(CONFIG))
    await waitFor(() => expect(result.current.data).toEqual(CONFIG))
  })
})
