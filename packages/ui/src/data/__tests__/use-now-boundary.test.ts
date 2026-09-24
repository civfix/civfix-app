import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MAX_TIMER_DELAY_MS, armBoundaryTimer } from "../useNow"

const DAY_MS = 86_400_000
const START = Date.UTC(2026, 8, 23, 12, 0)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useNow's boundary timer beyond the setTimeout limit", () => {
  it("does not fire early for a boundary a month away (a raw setTimeout would fire in ~1 ms)", () => {
    const reached = vi.fn()
    armBoundaryTimer(START + 30 * DAY_MS, reached)

    vi.advanceTimersByTime(10)
    expect(reached).not.toHaveBeenCalled()

    vi.advanceTimersByTime(MAX_TIMER_DELAY_MS)
    expect(reached).not.toHaveBeenCalled()

    vi.advanceTimersByTime(30 * DAY_MS - MAX_TIMER_DELAY_MS - 11)
    expect(reached).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(reached).toHaveBeenCalledTimes(1)
  })

  it("steps toward a far boundary in capped timers instead of an overflowed one", () => {
    armBoundaryTimer(START + 30 * DAY_MS, () => undefined)
    vi.advanceTimersToNextTimer()
    expect(Date.now()).toBe(START + MAX_TIMER_DELAY_MS)
  })

  it("fires once at a near boundary and arms nothing for a past one", () => {
    const near = vi.fn()
    armBoundaryTimer(START + 5_000, near)
    vi.advanceTimersByTime(4_999)
    expect(near).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(near).toHaveBeenCalledTimes(1)

    const past = vi.fn()
    armBoundaryTimer(START - 1, past)
    expect(vi.getTimerCount()).toBe(0)
    expect(past).not.toHaveBeenCalled()
  })

  it("cancels a re-armed step as well as the first one", () => {
    const reached = vi.fn()
    const cancel = armBoundaryTimer(START + 60 * DAY_MS, reached)
    vi.advanceTimersByTime(MAX_TIMER_DELAY_MS)
    expect(vi.getTimerCount()).toBe(1)
    cancel()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(60 * DAY_MS)
    expect(reached).not.toHaveBeenCalled()
  })

  it("is what the hook arms for its boundary", () => {
    const src = readFileSync(new URL("../useNow.ts", import.meta.url), "utf8")
    expect(src).toContain("return armBoundaryTimer(boundaryAt, () => setNow(Date.now()))")
    expect(src).not.toMatch(/setTimeout\(\(\) => setNow/)
  })
})
