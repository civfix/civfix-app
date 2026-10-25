import { afterEach, describe, expect, it, vi } from "vitest"
import { webPushPermission } from "./push-permission"

type BrowserPermission = "default" | "granted" | "denied"

function stubNotification(permission: BrowserPermission, answers: BrowserPermission[] = []) {
  const requestPermission = vi.fn(async (): Promise<BrowserPermission> => {
    const answer = answers.shift() ?? permission
    notification.permission = answer
    return answer
  })
  const notification = { permission, requestPermission }
  vi.stubGlobal("Notification", notification)
  return notification
}

const stubPushManager = () => vi.stubGlobal("PushManager", function PushManager() {})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("webPushPermission", () => {
  it("T6: reports unsupported when the browser has PushManager but no Notification", async () => {
    stubPushManager()
    vi.stubGlobal("Notification", undefined)
    await expect(webPushPermission.status()).resolves.toBe("unsupported")
    await expect(webPushPermission.request()).resolves.toBe("unsupported")
  })

  it("T7: reports unsupported without PushManager, and never prompts", async () => {
    const notification = stubNotification("default")
    vi.stubGlobal("PushManager", undefined)
    await expect(webPushPermission.status()).resolves.toBe("unsupported")
    await expect(webPushPermission.request()).resolves.toBe("unsupported")
    expect(notification.requestPermission).toHaveBeenCalledTimes(0)
  })

  it("T8: maps Notification.permission, read at each call", async () => {
    stubPushManager()
    const notification = stubNotification("default")
    await expect(webPushPermission.status()).resolves.toBe("undetermined")
    notification.permission = "granted"
    await expect(webPushPermission.status()).resolves.toBe("granted")
    notification.permission = "denied"
    await expect(webPushPermission.status()).resolves.toBe("denied")
  })

  it("T9: request() prompts once and resolves the browser's answer", async () => {
    stubPushManager()
    const notification = stubNotification("default", ["granted"])
    await expect(webPushPermission.request()).resolves.toBe("granted")
    expect(notification.requestPermission).toHaveBeenCalledTimes(1)
  })

  it("T10: a denial maps to denied and a dismissed prompt to undetermined", async () => {
    stubPushManager()
    stubNotification("default", ["denied", "default"])
    await expect(webPushPermission.request()).resolves.toBe("denied")
    await expect(webPushPermission.request()).resolves.toBe("undetermined")
  })

  it("T11: has no openSettings, since a page cannot open the browser's site settings", () => {
    expect("openSettings" in webPushPermission).toBe(false)
  })

  it("T12: importing the module touches no browser API", async () => {
    vi.stubGlobal("Notification", undefined)
    vi.stubGlobal("PushManager", undefined)
    vi.resetModules()
    await expect(import("./push-permission")).resolves.toHaveProperty("webPushPermission")
    const notification = stubNotification("default")
    stubPushManager()
    expect(notification.requestPermission).toHaveBeenCalledTimes(0)
  })
})
