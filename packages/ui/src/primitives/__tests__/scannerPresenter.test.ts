import { afterEach, describe, expect, it } from "vitest"
import {
  presentScanner,
  resetScanPresenterForTests,
  resolveScan,
  scannerAvailable,
  setScanPresenter,
  subscribeScannerAvailability,
} from "../scannerPresenter"

afterEach(() => resetScanPresenterForTests())

describe("scannerAvailable", () => {
  it("is false with no presenter, so a UI hides the Scan action instead of offering a dead button", () => {
    expect(scannerAvailable()).toBe(false)
  })

  it("is true once a host registers one", () => {
    setScanPresenter(() => {})
    expect(scannerAvailable()).toBe(true)
  })
})

describe("presentScanner", () => {
  it("resolves null immediately when no presenter is registered", async () => {
    await expect(presentScanner()).resolves.toBeNull()
  })

  it("hands the presenter a session id and resolves with the token for that session", async () => {
    let session = ""
    setScanPresenter((id) => {
      session = id
    })
    const pending = presentScanner()
    expect(session).not.toBe("")
    resolveScan("tok-1", session)
    await expect(pending).resolves.toBe("tok-1")
  })

  it("resolves null when the scan surface is dismissed", async () => {
    setScanPresenter(() => {})
    const pending = presentScanner()
    resolveScan(null)
    await expect(pending).resolves.toBeNull()
  })

  it("IGNORES a resolve carrying a stale session id", async () => {
    let session = ""
    setScanPresenter((id) => {
      session = id
    })
    const pending = presentScanner()
    resolveScan("from-an-old-scan", "scan-999")
    resolveScan("tok-2", session)
    await expect(pending).resolves.toBe("tok-2")
  })

  it("cancels an in-flight scan when a second one starts, never leaving the first hanging", async () => {
    const sessions: string[] = []
    setScanPresenter((id) => sessions.push(id))
    const first = presentScanner()
    const second = presentScanner()
    await expect(first).resolves.toBeNull()
    resolveScan("tok-3", sessions[1] as string)
    await expect(second).resolves.toBe("tok-3")
  })

  it("cancels an in-flight scan when the host tears its presenter down", async () => {
    setScanPresenter(() => {})
    const pending = presentScanner()
    setScanPresenter(null)
    await expect(pending).resolves.toBeNull()
    expect(scannerAvailable()).toBe(false)
  })

  it("is a no-op to resolve when nothing is pending", () => {
    expect(() => resolveScan("tok-4")).not.toThrow()
  })
})

describe("subscribeScannerAvailability", () => {
  it("notifies when a presenter appears and when it goes away", () => {
    let calls = 0
    const stop = subscribeScannerAvailability(() => {
      calls += 1
    })
    setScanPresenter(() => {})
    expect(calls).toBe(1)
    setScanPresenter(null)
    expect(calls).toBe(2)
    stop()
  })

  it("does NOT notify when one presenter simply replaces another", () => {
    setScanPresenter(() => {})
    let calls = 0
    const stop = subscribeScannerAvailability(() => {
      calls += 1
    })
    setScanPresenter(() => {})
    expect(calls).toBe(0)
    stop()
  })

  it("stops notifying after unsubscribe", () => {
    let calls = 0
    subscribeScannerAvailability(() => {
      calls += 1
    })()
    setScanPresenter(() => {})
    expect(calls).toBe(0)
  })
})
