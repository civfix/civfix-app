import { describe, expect, it } from "vitest"
import { makeFakeCapabilities, type FakePushPermission, type PushPermissionStatus } from ".."

const fakePushPermission = (): FakePushPermission =>
  makeFakeCapabilities().pushPermission as FakePushPermission

describe("the fake pushPermission capability", () => {
  it("T1: a fresh fake reports unsupported and offers openSettings", async () => {
    const fake = fakePushPermission()
    await expect(fake.status()).resolves.toBe("unsupported")
    expect(typeof fake.openSettings).toBe("function")
  })

  it("T2: setStatus sets what status() resolves, for every status", async () => {
    const fake = fakePushPermission()
    for (const s of ["granted", "denied", "undetermined", "unsupported"] as PushPermissionStatus[]) {
      fake.setStatus(s)
      await expect(fake.status()).resolves.toBe(s)
    }
  })

  it("T3: request() resolves the set request result and the status becomes it", async () => {
    const fake = fakePushPermission()
    fake.setStatus("undetermined")
    fake.setRequestResult("granted")
    await expect(fake.request()).resolves.toBe("granted")
    expect(fake.requested).toBe(1)
    await expect(fake.status()).resolves.toBe("granted")
  })

  it("T4: with no request result set, request() resolves the current status", async () => {
    const fake = fakePushPermission()
    fake.setStatus("denied")
    await expect(fake.request()).resolves.toBe("denied")
    expect(fake.requested).toBe(1)
  })

  it("T5: openSettings() resolves undefined and counts each call", async () => {
    const fake = fakePushPermission()
    await expect(fake.openSettings()).resolves.toBeUndefined()
    await expect(fake.openSettings()).resolves.toBeUndefined()
    expect(fake.settingsOpened).toBe(2)
  })
})
