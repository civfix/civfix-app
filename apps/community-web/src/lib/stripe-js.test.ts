import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const loadStripe = vi.fn()
const setLoadParameters = vi.fn()

vi.mock("@stripe/stripe-js/pure", () => ({
  loadStripe: Object.assign(loadStripe, { setLoadParameters }),
}))

const source = readFileSync(fileURLToPath(new URL("./stripe-js.ts", import.meta.url)), "utf8")

async function freshModule() {
  vi.resetModules()
  return import("./stripe-js")
}

describe("Stripe.js loader source", () => {
  it("imports the PURE entry so the script is not injected at module evaluation", () => {
    expect(source).toContain('from "@stripe/stripe-js/pure"')
    const valueImports = source
      .split("\n")
      .filter((line) => line.startsWith("import ") && !line.startsWith("import type "))
      .filter((line) => line.includes('"@stripe/stripe-js"'))
    expect(valueImports).toEqual([])
  })

  it("turns off the m.stripe.com fraud beacon, per the cookies-page commitment", () => {
    expect(source).toContain("setLoadParameters({ advancedFraudSignals: false })")
  })
})

describe("loadStripeForAccount", () => {
  beforeEach(() => {
    loadStripe.mockReset()
    setLoadParameters.mockReset()
    vi.stubGlobal("window", {})
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_123")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("binds the connected account, because donations are direct charges", async () => {
    const stripe = { id: "stripe" }
    loadStripe.mockResolvedValue(stripe)
    const loader = await freshModule()
    await expect(loader.loadStripeForAccount("acct_1")).resolves.toBe(stripe)
    expect(loadStripe).toHaveBeenCalledWith("pk_test_123", { stripeAccount: "acct_1" })
  })

  it("memoizes per key and account", async () => {
    loadStripe.mockResolvedValue({ id: "stripe" })
    const loader = await freshModule()
    const first = loader.loadStripeForAccount("acct_1")
    const second = loader.loadStripeForAccount("acct_1")
    expect(first).toBe(second)
    await first
    loader.loadStripeForAccount("acct_2")
    expect(loadStripe).toHaveBeenCalledTimes(2)
  })

  it("never caches a failure, so one flaky load does not kill donations for the session", async () => {
    loadStripe.mockRejectedValueOnce(new Error("network"))
    const loader = await freshModule()
    await expect(loader.loadStripeForAccount("acct_1")).resolves.toBe(null)
    loadStripe.mockResolvedValueOnce({ id: "stripe" })
    await expect(loader.loadStripeForAccount("acct_1")).resolves.toEqual({ id: "stripe" })
    expect(loadStripe).toHaveBeenCalledTimes(2)
  })

  it("resolves null without loading anything when there is no publishable key", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "")
    const loader = await freshModule()
    await expect(loader.loadStripeForAccount("acct_1")).resolves.toBe(null)
    expect(loadStripe).not.toHaveBeenCalled()
  })

  it("resolves null without loading anything when there is no connected account", async () => {
    const loader = await freshModule()
    await expect(loader.loadStripeForAccount("")).resolves.toBe(null)
    expect(loadStripe).not.toHaveBeenCalled()
  })

  it("resolves null on the server rather than touching the DOM", async () => {
    vi.unstubAllGlobals()
    const loader = await freshModule()
    await expect(loader.loadStripeForAccount("acct_1")).resolves.toBe(null)
    expect(loadStripe).not.toHaveBeenCalled()
  })

  it("bounds a hung load and resolves null", async () => {
    vi.useFakeTimers()
    loadStripe.mockReturnValue(new Promise(() => undefined))
    const loader = await freshModule()
    const pending = loader.loadStripeForAccount("acct_1")
    await vi.advanceTimersByTimeAsync(15_001)
    await expect(pending).resolves.toBe(null)
    vi.useRealTimers()
  })
})

describe("isLiveKey", () => {
  it("recognizes only a live key", async () => {
    const loader = await freshModule()
    expect(loader.isLiveKey("pk_live_1")).toBe(true)
    expect(loader.isLiveKey("pk_test_1")).toBe(false)
    expect(loader.isLiveKey(undefined)).toBe(false)
  })
})
