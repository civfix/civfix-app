import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createIdleRunner, CLUSTER_IDLE_MS } from "../clusterSchedule"

describe("createIdleRunner", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("runs the first request immediately so a settled camera paints without delay", () => {
    const run = vi.fn()
    createIdleRunner(run, { now: () => Date.now() }).request()
    expect(run).toHaveBeenCalledTimes(1)
  })

  it("coalesces a burst of camera events into one trailing recompute", () => {
    const run = vi.fn()
    const runner = createIdleRunner(run, { intervalMs: 100, now: () => Date.now() })
    runner.request()
    expect(run).toHaveBeenCalledTimes(1)
    for (let i = 0; i < 20; i += 1) {
      vi.advanceTimersByTime(4)
      runner.request()
    }
    expect(run).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(100)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("runs again immediately once the quiet interval has passed", () => {
    const run = vi.fn()
    const runner = createIdleRunner(run, { intervalMs: 100, now: () => Date.now() })
    runner.request()
    vi.advanceTimersByTime(150)
    runner.request()
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("flush runs now and cancels the pending trailing run", () => {
    const run = vi.fn()
    const runner = createIdleRunner(run, { intervalMs: 100, now: () => Date.now() })
    runner.request()
    runner.request()
    runner.flush()
    expect(run).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(1000)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("dispose drops a pending run so an unmounted map never recomputes", () => {
    const run = vi.fn()
    const runner = createIdleRunner(run, { intervalMs: 100, now: () => Date.now() })
    runner.request()
    runner.request()
    runner.dispose()
    vi.advanceTimersByTime(1000)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it("refuses every later request once disposed", () => {
    const run = vi.fn()
    const runner = createIdleRunner(run, { intervalMs: 100, now: () => Date.now() })
    runner.dispose()
    runner.request()
    runner.flush()
    vi.advanceTimersByTime(1000)
    runner.request()
    vi.advanceTimersByTime(1000)
    expect(run).not.toHaveBeenCalled()
  })

  it("defaults to the shared map-idle interval", () => {
    const run = vi.fn()
    const runner = createIdleRunner(run)
    runner.request()
    runner.request()
    vi.advanceTimersByTime(CLUSTER_IDLE_MS - 1)
    expect(run).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(run).toHaveBeenCalledTimes(2)
  })
})
