import { afterEach, beforeEach, expect, vi } from "vitest"

/**
 * Pins the device zone for every test in the enclosing suite, so an assertion about a device-zone
 * fallback holds on any machine. Node re-reads TZ for Date and Intl when it is assigned on the main
 * thread but ignores the assignment inside a worker thread, so the check turns a pool that cannot
 * switch zones into a failure instead of a run against the host zone.
 */
export function pinDeviceTimeZone(zone: string): void {
  beforeEach(() => {
    vi.stubEnv("TZ", zone)
    const canonical = new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(canonical)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })
}
