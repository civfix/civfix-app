import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AppError, ErrorCode, type ReportPinDTO } from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"
import type { LatLng } from "@civfix/contract/geocode"
import { ApiProvider } from "../../../data/context"
import { makeFakeDataContext } from "../../../data/fakes"
import { useNavStore } from "../../../nav"
import { useDraftReportStore } from "../../../report/draftStore"
import { usePostComposerStore } from "../../postComposerStore"
import { useDuplicateGate } from "../useDuplicateGate"
import { northOf, pinAt } from "./duplicateTestPoints"

const A = { lat: 34.1, lng: -118.3 }
// 0.01° north of A: another nearby-pins query key, and far beyond 20 m of anything near A.
const B = { lat: 34.11, lng: -118.3 }

interface PendingAnswer {
  resolve: (pins: ReportPinDTO[]) => void
  reject: (err: unknown) => void
}

/** A `mapReports` whose every call waits until the test answers it. */
function heldMapReports() {
  const calls: PendingAnswer[] = []
  const mapReports = vi.fn(
    () =>
      new Promise((resolve, reject) => {
        calls.push({ resolve: (pins) => resolve({ pins }), reject })
      }),
  )
  return { mapReports, calls }
}

function renderGate(mapReports: (...args: unknown[]) => Promise<unknown>, resume?: () => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const context = makeFakeDataContext({ api: { mapReports } as unknown as ApiClient })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={context}>{children}</ApiProvider>
    </QueryClientProvider>
  )
  return renderHook(() => useDuplicateGate(resume), { wrapper })
}

const draft = () => useDraftReportStore.getState().draft

function placeDraft(point: LatLng) {
  useDraftReportStore.getState().setLocation(point.lat, point.lng, "manual")
}

function seedDraft(point: LatLng) {
  const store = useDraftReportStore.getState()
  store.startFromCapture({ uri: "file:///capture.jpg", kind: "image", mime: "image/jpeg" })
  store.setCategory("trash", "Trash", "litter")
  store.setTitle("Overflowing bin")
  placeDraft(point)
}

/** Renders the gate with a 10 m match at A and opens the screen through `run(onClear)`. */
async function openScreen(onClear: () => void) {
  const api = heldMapReports()
  const gate = renderGate(api.mapReports)
  act(() => gate.result.current.run(onClear))
  await act(async () => api.calls[0]?.resolve([pinAt("near", northOf(A, 10))]))
  await waitFor(() => expect(gate.result.current.matches).toHaveLength(1))
  return { gate, api }
}

beforeEach(() => {
  useDraftReportStore.getState().reset()
  useNavStore.getState().reset()
  usePostComposerStore.getState().reset()
  useNavStore.getState().selectView("report")
  seedDraft(A)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useDuplicateGate", () => {
  it("T16: is busy until the pins arrive, then opens the screen on a match and stores the checked point", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const api = heldMapReports()
    const gate = renderGate(api.mapReports)
    const onClear = vi.fn()

    act(() => gate.result.current.run(onClear))
    expect(gate.result.current.busy).toBe(true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(499)
    })
    expect(gate.result.current.busy).toBe(true)
    expect(gate.result.current.matches).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
      api.calls[0]?.resolve([pinAt("near", northOf(A, 10))])
    })
    await waitFor(() => expect(gate.result.current.busy).toBe(false))
    expect(gate.result.current.matches).toHaveLength(1)
    expect(gate.result.current.matches?.[0]?.pin.id).toBe("near")
    expect(onClear).not.toHaveBeenCalled()
    expect(draft().duplicateCheckedPoint).toEqual(A)
  })

  it("T17: carries on when only a resolved pin is close and the open one is 60 m away", async () => {
    const api = heldMapReports()
    const gate = renderGate(api.mapReports)
    const onClear = vi.fn()

    act(() => gate.result.current.run(onClear))
    await act(async () =>
      api.calls[0]?.resolve([
        pinAt("resolved", northOf(A, 5), "resolved"),
        pinAt("far", northOf(A, 60)),
      ]),
    )
    await waitFor(() => expect(onClear).toHaveBeenCalledTimes(1))
    expect(gate.result.current.matches).toBeNull()
    expect(draft().duplicateCheckedPoint).toEqual(A)
  })

  it("T18: gives up after 3 seconds and ignores an answer that comes later", async () => {
    vi.useFakeTimers()
    const api = heldMapReports()
    const gate = renderGate(api.mapReports)
    const onClear = vi.fn()

    act(() => gate.result.current.run(onClear))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2999)
    })
    expect(gate.result.current.busy).toBe(true)
    expect(onClear).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(gate.result.current.busy).toBe(false)
    expect(gate.result.current.matches).toBeNull()
    expect(draft().duplicateCheckedPoint).toEqual(A)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
      api.calls[0]?.resolve([pinAt("near", northOf(A, 10))])
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(gate.result.current.matches).toBeNull()
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it("T19: carries on as soon as the pins fail to load", async () => {
    vi.useFakeTimers()
    const api = heldMapReports()
    const gate = renderGate(api.mapReports)
    const onClear = vi.fn()

    act(() => gate.result.current.run(onClear))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
      api.calls[0]?.reject(new AppError(ErrorCode.INTERNAL, "boom", { httpStatus: 500 }))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(gate.result.current.busy).toBe(false)
    expect(gate.result.current.matches).toBeNull()
  })

  it("T20: ignores a second press while busy and asks for the pins once", async () => {
    const api = heldMapReports()
    const gate = renderGate(api.mapReports)
    const onClear = vi.fn()

    act(() => gate.result.current.run(onClear))
    act(() => gate.result.current.run(onClear))
    await act(async () => api.calls[0]?.resolve([]))
    await waitFor(() => expect(onClear).toHaveBeenCalledTimes(1))
    expect(api.mapReports).toHaveBeenCalledTimes(1)
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it("T21: never opens the screen from the previous point's placeholder pins", async () => {
    const api = heldMapReports()
    const gate = renderGate(api.mapReports)
    await act(async () => api.calls[0]?.resolve([pinAt("near-a", northOf(A, 10))]))
    await waitFor(() => expect(api.mapReports).toHaveBeenCalledTimes(1))

    act(() => placeDraft(B))
    await waitFor(() => expect(api.mapReports).toHaveBeenCalledTimes(2))
    const onClear = vi.fn()
    act(() => gate.result.current.run(onClear))
    expect(gate.result.current.matches).toBeNull()
    expect(onClear).not.toHaveBeenCalled()

    await act(async () => api.calls[1]?.resolve([]))
    await waitFor(() => expect(onClear).toHaveBeenCalledTimes(1))
    expect(gate.result.current.matches).toBeNull()
  })

  it("checks the new point when a press lands in the same tick as the picker's confirm", async () => {
    const api = heldMapReports()
    const gate = renderGate(api.mapReports)
    await act(async () => api.calls[0]?.resolve([]))
    await waitFor(() => expect(gate.result.current.busy).toBe(false))
    const onClear = vi.fn()

    act(() => {
      placeDraft(B)
      gate.result.current.run(onClear)
    })
    expect(onClear).not.toHaveBeenCalled()
    expect(gate.result.current.busy).toBe(true)
    await waitFor(() => expect(api.mapReports).toHaveBeenCalledTimes(2))
    await act(async () => api.calls[1]?.resolve([pinAt("near-b", northOf(B, 10))]))
    await waitFor(() => expect(gate.result.current.matches).toHaveLength(1))
    expect(onClear).not.toHaveBeenCalled()
    expect(draft().duplicateCheckedPoint).toEqual(B)
  })

  it("T22: carries on at once for a point already checked", () => {
    useDraftReportStore.getState().setDuplicateCheckedPoint(A)
    const api = heldMapReports()
    const gate = renderGate(api.mapReports)
    const busy: boolean[] = []
    const onClear = vi.fn(() => busy.push(gate.result.current.busy))

    act(() => gate.result.current.run(onClear))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(busy).toEqual([false])
    expect(gate.result.current.busy).toBe(false)
    expect(api.mapReports).not.toHaveBeenCalled()
  })

  it("T23: Report a new problem closes the screen and carries on with the run's continuation", async () => {
    const onClear = vi.fn()
    const { gate } = await openScreen(onClear)

    act(() => gate.result.current.reportNew())
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(gate.result.current.matches).toBeNull()
    expect(draft().duplicateCheckedPoint).toEqual(A)
  })

  it("T24: Back closes the screen, keeps the draft and does not check the point again", async () => {
    const onClear = vi.fn()
    const { gate, api } = await openScreen(onClear)
    const before = draft()

    act(() => gate.result.current.dismiss())
    expect(gate.result.current.matches).toBeNull()
    expect(onClear).not.toHaveBeenCalled()
    expect(draft().media).toEqual(before.media)
    expect(draft().category).toBe(before.category)
    expect(draft().title).toBe(before.title)
    expect({ lat: draft().lat, lng: draft().lng }).toEqual(A)

    const onClear2 = vi.fn()
    act(() => gate.result.current.run(onClear2))
    expect(onClear2).toHaveBeenCalledTimes(1)
    expect(api.mapReports).toHaveBeenCalledTimes(1)
  })

  it("T25: opening a match pushes its report over the flow and keeps the draft and the screen", async () => {
    const { gate } = await openScreen(vi.fn())
    const before = draft()
    const row = gate.result.current.matches?.[0]
    if (!row) throw new Error("the screen did not open")

    act(() => gate.result.current.openMatch(row))
    expect(useNavStore.getState().stack.at(-1)).toEqual({
      kind: "pin",
      id: row.pin.id,
      lat: row.pin.lat,
      lng: row.pin.lng,
    })
    expect(draft()).toEqual(before)
    expect(draft().media).toHaveLength(1)
    expect(gate.result.current.matches).toEqual([row])

    act(() => useNavStore.getState().back())
    expect(gate.result.current.matches).toEqual([row])
  })

  it("T26: from the post composer, opening a match attaches it and returns to the composer", async () => {
    const composer = usePostComposerStore.getState()
    composer.setPendingCreate("report")
    composer.claimPendingCreate("report")
    expect(usePostComposerStore.getState().claimedCreate).toBe("report")
    const { gate } = await openScreen(vi.fn())
    const row = gate.result.current.matches?.[0]
    if (!row) throw new Error("the screen did not open")

    act(() => gate.result.current.openMatch(row))
    expect(usePostComposerStore.getState().draft.attachedReport?.id).toBe(row.pin.id)
    expect(usePostComposerStore.getState().claimedCreate).toBeNull()
    expect(draft().media).toEqual([])
    expect(draft().lat).toBeNull()
    const nav = useNavStore.getState()
    expect(nav.active).toEqual({ kind: "composer" })
    expect(nav.stack.some((entry) => entry.kind === "pin")).toBe(false)
  })

  it("Back while a check is still waiting drops it, so its answer never moves the flow", async () => {
    const api = heldMapReports()
    const gate = renderGate(api.mapReports)
    const onClear = vi.fn()

    act(() => gate.result.current.run(onClear))
    expect(gate.result.current.busy).toBe(true)
    act(() => gate.result.current.dismiss())
    expect(gate.result.current.busy).toBe(false)
    await act(async () => api.calls[0]?.resolve([pinAt("near", northOf(A, 10))]))
    expect(onClear).not.toHaveBeenCalled()
    expect(gate.result.current.matches).toBeNull()
    expect(draft().duplicateCheckedPoint).toBeNull()
  })

  it("keeps the screen for a body that mounts again, and carries on with that body's resume", async () => {
    const onClear = vi.fn()
    const { gate } = await openScreen(onClear)
    const rows = gate.result.current.matches
    gate.unmount()

    const resume = vi.fn()
    const remounted = renderGate(heldMapReports().mapReports, resume)
    expect(remounted.result.current.matches).toEqual(rows)
    act(() => remounted.result.current.reportNew())
    expect(resume).toHaveBeenCalledTimes(1)
    expect(onClear).not.toHaveBeenCalled()
    expect(remounted.result.current.matches).toBeNull()
  })

  it("checks the point it was moved to while a check waited, and opens the screen for it", async () => {
    const api = heldMapReports()
    const gate = renderGate(api.mapReports)
    const onClear = vi.fn()

    act(() => gate.result.current.run(onClear))
    act(() => placeDraft(B))
    await waitFor(() => expect(api.mapReports).toHaveBeenCalledTimes(2))
    expect(gate.result.current.busy).toBe(true)
    await act(async () => api.calls[1]?.resolve([pinAt("near-b", northOf(B, 10))]))
    await waitFor(() => expect(gate.result.current.matches).toHaveLength(1))
    expect(gate.result.current.matches?.[0]?.pin.id).toBe("near-b")
    expect(gate.result.current.busy).toBe(false)
    expect(onClear).not.toHaveBeenCalled()
    expect(draft().duplicateCheckedPoint).toEqual(B)

    await act(async () => api.calls[0]?.resolve([]))
    expect(gate.result.current.matches).toHaveLength(1)
    expect(onClear).not.toHaveBeenCalled()
  })

  it("keeps the press's 3 seconds when the point moves, and stores the point it moved to", async () => {
    vi.useFakeTimers()
    const api = heldMapReports()
    const gate = renderGate(api.mapReports)
    const onClear = vi.fn()

    act(() => gate.result.current.run(onClear))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    act(() => placeDraft(B))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999)
    })
    expect(gate.result.current.busy).toBe(true)
    expect(onClear).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(gate.result.current.busy).toBe(false)
    expect(draft().duplicateCheckedPoint).toEqual(B)
  })

  it("carries on at once when a waiting check's point moves to one already checked", async () => {
    useDraftReportStore.getState().setDuplicateCheckedPoint(B)
    const api = heldMapReports()
    const gate = renderGate(api.mapReports)
    const onClear = vi.fn()

    act(() => gate.result.current.run(onClear))
    expect(gate.result.current.busy).toBe(true)
    act(() => placeDraft(B))
    await waitFor(() => expect(onClear).toHaveBeenCalledTimes(1))
    expect(gate.result.current.busy).toBe(false)
    expect(gate.result.current.matches).toBeNull()
    expect(api.mapReports).toHaveBeenCalledTimes(1)
  })

  it("drops a waiting check when the draft is reset, so the press never carries on", async () => {
    vi.useFakeTimers()
    const api = heldMapReports()
    const gate = renderGate(api.mapReports)
    const onClear = vi.fn()

    act(() => gate.result.current.run(onClear))
    act(() => useDraftReportStore.getState().reset())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(onClear).not.toHaveBeenCalled()
    expect(gate.result.current.busy).toBe(false)
    expect(draft().duplicateCheckedPoint).toBeNull()
  })

  it("never shows a screen that belongs to a reset draft", async () => {
    const { gate } = await openScreen(vi.fn())
    act(() => {
      useDraftReportStore.getState().reset()
      seedDraft(A)
    })
    expect(gate.result.current.matches).toBeNull()
  })
})
