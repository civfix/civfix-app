import { afterEach, describe, expect, it, vi } from "vitest"
import { withTimeout } from "../src/async.js"
import { DEVICE_FIX_TIMEOUT_MS } from "../src/geo.js"

/**
 * Every caller writes the result of its first read into a query cache with an infinite staleTime, so a
 * `withTimeout` that swallowed a value or rejected, or a cap that never fired, would make one bad read last
 * the whole session.
 */
describe("withTimeout", () => {
  afterEach(() => vi.useRealTimers())

  it("resolves a promise that settles in time with its own value, untouched", async () => {
    const value = { coords: { latitude: 1, longitude: 2 } }
    await expect(withTimeout(Promise.resolve(value), 50)).resolves.toBe(value)
    await expect(withTimeout(Promise.resolve(7), 50)).resolves.toBe(7)
  })

  it("keeps falsy values as values, not misses", async () => {
    await expect(withTimeout(Promise.resolve(0), 50)).resolves.toBe(0)
    await expect(withTimeout(Promise.resolve(false), 50)).resolves.toBe(false)
  })

  it("resolves null at the cap when the promise never settles, instead of hanging the caller", async () => {
    const started = Date.now()
    const result = await withTimeout(new Promise<string>(() => {}), 20)
    expect(result).toBeNull()
    expect(Date.now() - started).toBeGreaterThanOrEqual(15)
  })

  it("settles null exactly once the cap passes (an unanswered permission prompt)", async () => {
    vi.useFakeTimers()
    const settled = withTimeout(new Promise<never>(() => {}), 4000)
    vi.advanceTimersByTime(4000)
    await expect(settled).resolves.toBeNull()
  })

  it("flattens a rejection to null rather than propagating it", async () => {
    await expect(withTimeout(Promise.reject(new Error("services off")), 50)).resolves.toBeNull()
    await expect(withTimeout(Promise.reject(new Error("denied")), 50)).resolves.toBeNull()
  })

  it("never lets a value that lands after the cap overwrite the null the caller already got", async () => {
    let settle: (v: string) => void = () => {}
    const slow = new Promise<string>((resolve) => {
      settle = resolve
    })
    const raced = withTimeout(slow, 10)
    await expect(raced).resolves.toBeNull()
    settle("late fix")
    await expect(raced).resolves.toBeNull()
  })
})

describe("DEVICE_FIX_TIMEOUT_MS", () => {
  it("is the 4 s every device-fix caller waits before falling back to the approximate location", () => {
    expect(DEVICE_FIX_TIMEOUT_MS).toBe(4000)
  })
})
