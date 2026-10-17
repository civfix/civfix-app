import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { AppError, ErrorCode, type BBox, type ReportPinDTO } from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"
import { ApiProvider } from "../context"
import { makeFakeDataContext } from "../fakes"
import { nearbyPinsBbox, useNearbyReportPins, usePressingReports } from "../index"

const B: BBox = { west: -118.2665, east: -118.2215, south: 34.0295, north: 34.0745 }

const pin = (id: string, confirmCount: number): ReportPinDTO =>
  ({ id, lat: 34.05, lng: -118.24, category: "trash", status: "published", confirmCount }) as ReportPinDTO

const p1 = pin("p1", 4)
const p2 = pin("p2", 2)

// The client's default retry policy, so "called exactly once" proves the hook itself turns retries off.
function renderWithApi<T>(useHook: () => T, api: Record<string, unknown>) {
  const queryClient = new QueryClient()
  const context = makeFakeDataContext({ api: api as unknown as ApiClient })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={context}>{children}</ApiProvider>
    </QueryClientProvider>
  )
  return { ...renderHook(useHook, { wrapper }), queryClient }
}

describe("usePressingReports", () => {
  it("T1: asks for the bbox once, under the pressing key, and returns the items", async () => {
    const pressingReports = vi.fn(async (_req: { bbox: BBox }, _opts?: unknown) => ({ items: [p1, p2] }))
    const { result, queryClient } = renderWithApi(() => usePressingReports(B), { pressingReports })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(pressingReports).toHaveBeenCalledTimes(1)
    expect(pressingReports.mock.calls[0]![0]).toEqual({ bbox: B })
    expect(queryClient.getQueryCache().getAll().map((q) => q.queryKey)).toEqual([["map", "reports", "pressing", B]])
    expect(result.current.data).toEqual([p1, p2])
  })

  it("T2: never calls the API without a location", async () => {
    const pressingReports = vi.fn(async () => ({ items: [p1] }))
    const { result } = renderWithApi(() => usePressingReports(null), { pressingReports })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(pressingReports).not.toHaveBeenCalled()
    expect(result.current.data).toBeUndefined()
  })

  it("T3: a 500 leaves the query errored with no data, after exactly one call", async () => {
    const failure = new AppError(ErrorCode.INTERNAL, "boom")
    expect(failure.httpStatus).toBe(500)
    const pressingReports = vi.fn(async () => {
      throw failure
    })
    const { result } = renderWithApi(() => usePressingReports(B), { pressingReports })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
    expect(pressingReports).toHaveBeenCalledTimes(1)
  })

  it("T4: a Me too's invalidation of the map reports refetches the ranking", async () => {
    const pressingReports = vi.fn(async () => ({ items: [p1, p2] }))
    const { result, queryClient } = renderWithApi(() => usePressingReports(B), { pressingReports })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["map", "reports"] })
    })
    await waitFor(() => expect(pressingReports).toHaveBeenCalledTimes(2))
  })
})

describe("nearbyPinsBbox", () => {
  it("T5: is the area Reports nearby asks the map for", async () => {
    const point = { lat: 34.05224, lng: -118.24368 }
    const mapReports = vi.fn(async () => ({ pins: [] }))
    const { result } = renderWithApi(() => useNearbyReportPins(point), { mapReports })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const received = (mapReports.mock.calls[0] as unknown as [{ bbox: BBox }])[0].bbox
    const bbox = nearbyPinsBbox(point)
    expect(bbox).toEqual(received)
    for (const side of ["west", "east", "south", "north"] as const) {
      expect(Math.abs(bbox![side] - B[side])).toBeLessThanOrEqual(1e-9)
    }
  })

  it("T6: is null without a point", () => {
    expect(nearbyPinsBbox(null)).toBeNull()
  })
})
