import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SEARCH_DEBOUNCE_MS, armDebounce, useDebouncedValue } from "../useDebouncedValue"

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function Probe({ value }: { value: string }) {
  return createElement("span", null, useDebouncedValue(value, SEARCH_DEBOUNCE_MS))
}

describe("useDebouncedValue", () => {
  it("returns the current value on the first render, without waiting for the delay", () => {
    expect(renderToStaticMarkup(createElement(Probe, { value: "park" }))).toBe("<span>park</span>")
  })
})

describe("armDebounce", () => {
  it("commits the value only once the full delay has elapsed", () => {
    const commit = vi.fn()
    armDebounce("park", SEARCH_DEBOUNCE_MS, commit)

    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1)
    expect(commit).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(commit).toHaveBeenCalledTimes(1)
    expect(commit).toHaveBeenCalledWith("park")
  })

  it("commits nothing when cancelled before the delay, as a new keystroke does", () => {
    const commit = vi.fn()
    const cancel = armDebounce("pa", SEARCH_DEBOUNCE_MS, commit)
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1)
    cancel()

    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
    expect(commit).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("settles a burst of keystrokes on the last value, one delay after the last one", () => {
    const commit = vi.fn()
    let cancel = armDebounce("p", SEARCH_DEBOUNCE_MS, commit)
    for (const next of ["pa", "par", "park"]) {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1)
      cancel()
      cancel = armDebounce(next, SEARCH_DEBOUNCE_MS, commit)
    }

    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1)
    expect(commit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(commit).toHaveBeenCalledTimes(1)
    expect(commit).toHaveBeenCalledWith("park")
  })

  it("honours a caller's own delay instead of the search default", () => {
    const consoleDelayMs = 300
    const commit = vi.fn()
    armDebounce("q", consoleDelayMs, commit)

    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
    expect(commit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(consoleDelayMs - SEARCH_DEBOUNCE_MS)
    expect(commit).toHaveBeenCalledWith("q")
  })
})
