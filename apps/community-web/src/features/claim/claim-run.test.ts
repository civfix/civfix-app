import { describe, expect, it, vi } from "vitest"

import { createClaimGate, runGuardedClaim } from "./claim-run"

/**
 * A claim for code X still in flight when the URL's ?code= switches to Y must not write its result into
 * the page: that would show X's report under Y's URL and park the phase on "done", and Y's auto-claim
 * only fires from phase "intro".
 */

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("createClaimGate", () => {
  it("keeps the only attempt current", () => {
    const gate = createClaimGate()
    expect(gate.begin()()).toBe(true)
  })

  it("retires an attempt once a newer one begins", () => {
    const gate = createClaimGate()
    const first = gate.begin()
    const second = gate.begin()
    expect(first()).toBe(false)
    expect(second()).toBe(true)
  })

  it("retires the in-flight attempt on abandon, and arms the next one", () => {
    const gate = createClaimGate()
    const attempt = gate.begin()
    gate.abandon()
    expect(attempt()).toBe(false)
    expect(gate.begin()()).toBe(true)
  })
})

describe("runGuardedClaim", () => {
  it("applies a successful claim for the current attempt", async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()
    const onStart = vi.fn()
    await runGuardedClaim({
      claimCode: "CODE-X",
      gate: createClaimGate(),
      claim: (code) => Promise.resolve({ report: code }),
      onStart,
      onSuccess,
      onError,
    })
    expect(onStart).toHaveBeenCalledOnce()
    expect(onSuccess).toHaveBeenCalledWith({ report: "CODE-X" })
    expect(onError).not.toHaveBeenCalled()
  })

  it("applies a failure for the current attempt", async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()
    const boom = new Error("nope")
    await runGuardedClaim({
      claimCode: "CODE-X",
      gate: createClaimGate(),
      claim: () => Promise.reject(boom),
      onStart: () => {},
      onSuccess,
      onError,
    })
    expect(onError).toHaveBeenCalledWith(boom)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it("claims the code captured at start, not a later one", async () => {
    const claim = vi.fn(() => Promise.resolve("ok"))
    let claimCode = "CODE-X"
    const run = runGuardedClaim({
      claimCode,
      gate: createClaimGate(),
      claim,
      onStart: () => {},
      onSuccess: () => {},
      onError: () => {},
    })
    claimCode = "CODE-Y"
    await run
    expect(claim).toHaveBeenCalledWith("CODE-X")
  })

  it("drops the result of an attempt abandoned mid-flight", async () => {
    const gate = createClaimGate()
    const pending = deferred<{ report: string }>()
    const onSuccess = vi.fn()
    const onError = vi.fn()
    const run = runGuardedClaim({
      claimCode: "CODE-X",
      gate,
      claim: () => pending.promise,
      onStart: () => {},
      onSuccess,
      onError,
    })

    gate.abandon() // a new ?code= landed while the POST was out
    pending.resolve({ report: "report-X" })
    await run

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it("swallows the rejection of an abandoned attempt instead of showing its error", async () => {
    const gate = createClaimGate()
    const pending = deferred<never>()
    const onError = vi.fn()
    const run = runGuardedClaim({
      claimCode: "CODE-X",
      gate,
      claim: () => pending.promise,
      onStart: () => {},
      onSuccess: () => {},
      onError,
    })

    gate.abandon()
    pending.reject(new Error("expired"))
    await expect(run).resolves.toBeUndefined()
    expect(onError).not.toHaveBeenCalled()
  })

  it("still runs the code-scoped side effect when a superseded claim succeeds", async () => {
    // The report really was linked, so its stored handoff is spent even though the page has moved on.
    const gate = createClaimGate()
    const pending = deferred<{ report: string }>()
    const onClaimed = vi.fn()
    const onSuccess = vi.fn()
    const run = runGuardedClaim({
      claimCode: "CODE-X",
      gate,
      claim: () => pending.promise,
      onStart: () => {},
      onClaimed,
      onSuccess,
      onError: () => {},
    })

    gate.abandon()
    pending.resolve({ report: "report-X" })
    await run

    expect(onClaimed).toHaveBeenCalledWith({ report: "report-X" }, "CODE-X")
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it("lets the newer code win when both attempts are in flight", async () => {
    const gate = createClaimGate()
    const x = deferred<{ report: string }>()
    const y = deferred<{ report: string }>()
    const applied: string[] = []

    const runX = runGuardedClaim({
      claimCode: "CODE-X",
      gate,
      claim: () => x.promise,
      onStart: () => {},
      onSuccess: (res) => applied.push(res.report),
      onError: () => {},
    })
    const runY = runGuardedClaim({
      claimCode: "CODE-Y",
      gate,
      claim: () => y.promise,
      onStart: () => {},
      onSuccess: (res) => applied.push(res.report),
      onError: () => {},
    })

    y.resolve({ report: "report-Y" })
    x.resolve({ report: "report-X" }) // the slower, superseded one
    await Promise.all([runX, runY])

    expect(applied).toEqual(["report-Y"])
  })
})

describe("claim page sequence", () => {
  type Page = { phase: "intro" | "claiming" | "done" | "error"; report: string | null }

  it("attempts a new ?code= that arrives mid-claim, and never announces the old report", async () => {
    const gate = createClaimGate()
    const page: Page = { phase: "intro", report: null }
    const pendingX = deferred<{ report: string }>()

    function run(claimCode: string, claim: () => Promise<{ report: string }>) {
      return runGuardedClaim({
        claimCode,
        gate,
        claim,
        onStart: () => {
          page.phase = "claiming"
        },
        onSuccess: (res) => {
          page.report = res.report
          page.phase = "done"
        },
        onError: () => {
          page.phase = "error"
        },
      })
    }

    const runX = run("CODE-X", () => pendingX.promise)
    expect(page.phase).toBe("claiming")

    gate.abandon()
    page.phase = "intro"

    // CODE-X's POST lands late and must not force "done", which would block CODE-Y's auto-claim.
    pendingX.resolve({ report: "report-X" })
    await runX
    expect(page).toEqual({ phase: "intro", report: null })

    await run("CODE-Y", () => Promise.resolve({ report: "report-Y" }))
    expect(page).toEqual({ phase: "done", report: "report-Y" })
  })
})
