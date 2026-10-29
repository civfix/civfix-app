import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useNow } from "../useNow"

const START = Date.UTC(2026, 9, 1, 12, 0, 0)

describe("useNow with a boundary read against its own clock", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("jumps to each boundary in turn, asking for the next one from the reading it just took", () => {
    const boundaries = [START + 5_000, START + 9_000]
    const nextBoundary = vi.fn((at: number) => boundaries.find((boundary) => boundary > at) ?? null)
    const { result } = renderHook(() => useNow(0, { boundaryAt: nextBoundary }))

    expect(result.current).toBe(START)
    expect(nextBoundary).toHaveBeenLastCalledWith(START)

    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(result.current).toBe(START + 5_000)
    expect(nextBoundary).toHaveBeenLastCalledWith(START + 5_000)

    act(() => {
      vi.advanceTimersByTime(4_000)
    })
    expect(result.current).toBe(START + 9_000)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("keeps ticking while a boundary is ahead and stops after the last one when asked to", () => {
    const end = START + 2_500
    const { result } = renderHook(() =>
      useNow(1_000, { boundaryAt: (at) => (at < end ? end : null), idleAfterLastBoundary: true }),
    )

    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(result.current).toBe(START + 1_000)

    act(() => {
      vi.advanceTimersByTime(1_500)
    })
    expect(result.current).toBe(end)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("keeps the periodic tick past the last boundary by default", () => {
    const { result } = renderHook(() => useNow(1_000, { boundaryAt: () => null }))

    act(() => {
      vi.advanceTimersByTime(3_000)
    })
    expect(result.current).toBe(START + 3_000)
    expect(vi.getTimerCount()).toBe(1)
  })
})
