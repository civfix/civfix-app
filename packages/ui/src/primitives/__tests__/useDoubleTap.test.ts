/**
 * Unit tests for the double-tap timing core behind `useDoubleTap` (P1 Task 1.2). The hook is a thin
 * React wrapper over `createTapController`, so the tap/timer contract is tested here without a renderer
 * (package convention: pure-logic vitest). Fake timers drive the 280ms window.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createTapController, DOUBLE_TAP_WINDOW_MS, type DoubleTapOptions } from "../useDoubleTap"

describe("createTapController", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function make(options: DoubleTapOptions) {
    return createTapController(() => options)
  }

  it("two taps within the window fire one onDoubleTap and zero onSingleTap", () => {
    const onSingleTap = vi.fn()
    const onDoubleTap = vi.fn()
    const ctl = make({ onSingleTap, onDoubleTap })

    ctl.tap()
    vi.advanceTimersByTime(200)
    ctl.tap()
    // Drain any stray timer: nothing further may fire.
    vi.advanceTimersByTime(1000)

    expect(onDoubleTap).toHaveBeenCalledTimes(1)
    expect(onSingleTap).not.toHaveBeenCalled()
  })

  it("two taps outside the window fire two onSingleTap and zero onDoubleTap", () => {
    const onSingleTap = vi.fn()
    const onDoubleTap = vi.fn()
    const ctl = make({ onSingleTap, onDoubleTap })

    ctl.tap()
    vi.advanceTimersByTime(400)
    ctl.tap()
    vi.advanceTimersByTime(1000)

    expect(onSingleTap).toHaveBeenCalledTimes(2)
    expect(onDoubleTap).not.toHaveBeenCalled()
  })

  it("the single tap is DELAYED by the window when a double-tap handler exists", () => {
    const onSingleTap = vi.fn()
    const ctl = make({ onSingleTap, onDoubleTap: vi.fn() })

    ctl.tap()
    expect(onSingleTap).not.toHaveBeenCalled()
    vi.advanceTimersByTime(DOUBLE_TAP_WINDOW_MS - 1)
    expect(onSingleTap).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onSingleTap).toHaveBeenCalledTimes(1)
  })

  it("fires the single tap immediately when no onDoubleTap is provided", () => {
    const onSingleTap = vi.fn()
    const ctl = make({ onSingleTap })

    ctl.tap()
    expect(onSingleTap).toHaveBeenCalledTimes(1)
    ctl.tap()
    expect(onSingleTap).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("cancel() clears a pending single-tap timer (unmount cleanup)", () => {
    const onSingleTap = vi.fn()
    const ctl = make({ onSingleTap, onDoubleTap: vi.fn() })

    ctl.tap()
    expect(vi.getTimerCount()).toBe(1)
    ctl.cancel()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(1000)
    expect(onSingleTap).not.toHaveBeenCalled()
  })

  it("triple-tap spam fires exactly one onDoubleTap and never a stray single (post-double cooldown)", () => {
    const onSingleTap = vi.fn()
    const onDoubleTap = vi.fn()
    const ctl = make({ onSingleTap, onDoubleTap })

    ctl.tap() // t=0
    vi.advanceTimersByTime(200)
    ctl.tap() // t=200 -> double fires, cooldown starts
    vi.advanceTimersByTime(200)
    ctl.tap() // t=400 -> inside cooldown (until 480): swallowed
    vi.advanceTimersByTime(2000)

    expect(onDoubleTap).toHaveBeenCalledTimes(1)
    expect(onSingleTap).not.toHaveBeenCalled()
  })

  it("a tap after the cooldown expires is a legit single again", () => {
    const onSingleTap = vi.fn()
    const onDoubleTap = vi.fn()
    const ctl = make({ onSingleTap, onDoubleTap })

    ctl.tap() // t=0
    vi.advanceTimersByTime(200)
    ctl.tap() // t=200 -> double fires, cooldown until 480
    vi.advanceTimersByTime(600)
    ctl.tap() // t=800 -> cooldown over: fresh window, single at 1080
    vi.advanceTimersByTime(2000)

    expect(onDoubleTap).toHaveBeenCalledTimes(1)
    expect(onSingleTap).toHaveBeenCalledTimes(1)
  })

  it("honors a custom windowMs", () => {
    const onSingleTap = vi.fn()
    const onDoubleTap = vi.fn()
    const ctl = make({ onSingleTap, onDoubleTap, windowMs: 100 })

    ctl.tap()
    vi.advanceTimersByTime(150)
    ctl.tap()
    vi.advanceTimersByTime(1000)

    // 150ms apart is outside a 100ms window: two singles.
    expect(onSingleTap).toHaveBeenCalledTimes(2)
    expect(onDoubleTap).not.toHaveBeenCalled()
  })
})
