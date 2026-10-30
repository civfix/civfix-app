import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AppError, ErrorCode, type NotificationDTO, type UserDTO } from "@civfix/contract"

import type * as AuthStoreModule from "@/store/auth-store"
import { fakeWindowClient, loadServiceWorker, type FakeNotification } from "./__fixtures__"

const api = {
  getPushWebConfig: vi.fn<() => Promise<{ vapidPublicKey: string | null }>>(),
  registerPush: vi.fn<(body: { platform: string; token: string }) => Promise<{ ok: true }>>(),
  pushUnregister: vi.fn<(body: { platform: string; token: string }) => Promise<{ ok: true }>>(),
  listNotifications:
    vi.fn<(query: { limit?: number }) => Promise<{ items: NotificationDTO[]; nextCursor: null }>>(),
  markNotificationsRead: vi.fn<(body: { ids: string[] }) => Promise<{ ok: true }>>(),
}

vi.mock("@/lib/api", () => ({ api }))

// The shell's nav adapter, as in use-web-nav-adapter.dom.test.tsx: only the nav store and a layout mode.
vi.mock("@civfix/ui", async () => {
  const nav = await import("@civfix/ui/nav")
  return { ...nav, layoutModeFor: () => "compact" }
})

const VAPID_KEY = "BKeyQ2l2Zml4VGVzdEtleQ"
const VAPID_KEY_BYTES = Uint8Array.from(atob("BKeyQ2l2Zml4VGVzdEtleQ=="), (c) => c.charCodeAt(0))

const USER: UserDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Ada Lovelace",
  handle: "ada",
  role: "citizen",
  locale: "en",
  profileComplete: true,
  createdAt: "2026-01-01T00:00:00.000Z",
}

interface FakeSubscription {
  endpoint: string
  options: { userVisibleOnly: boolean; applicationServerKey: ArrayBuffer | null }
  toJSON: () => object
  unsubscribe: ReturnType<typeof vi.fn>
}

let subscriptionCount = 0

function fakeSubscription(key: Uint8Array = VAPID_KEY_BYTES): FakeSubscription {
  subscriptionCount += 1
  const endpoint = `https://push.example/send/${subscriptionCount}`
  const subscription: FakeSubscription = {
    endpoint,
    options: { userVisibleOnly: true, applicationServerKey: key.slice().buffer },
    toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: "p", auth: "a" } }),
    unsubscribe: vi.fn(async () => {
      if (browser.subscription === subscription) browser.subscription = null
      return true
    }),
  }
  return subscription
}

const browser = {
  subscription: null as FakeSubscription | null,
  delivered: [] as FakeNotification[],
}

const pushManager = {
  getSubscription: vi.fn(async () => browser.subscription),
  subscribe: vi.fn(
    async (_options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) => {
      browser.subscription = fakeSubscription()
      return browser.subscription
    },
  ),
}

const registration = {
  scope: "/",
  pushManager,
  getNotifications: vi.fn(async () => browser.delivered),
}

class FakeServiceWorkerContainer extends EventTarget {
  registered = false
  register = vi.fn(async (_url: string, _options: { scope: string }) => {
    this.registered = true
    return registration
  })
  getRegistration = vi.fn(async () => (this.registered ? registration : undefined))
}

let container: FakeServiceWorkerContainer

function stubBrowser(permission: "default" | "granted" | "denied") {
  vi.stubGlobal("Notification", { permission, requestPermission: vi.fn(async () => permission) })
  vi.stubGlobal("PushManager", function PushManager() {})
  container = new FakeServiceWorkerContainer()
  Object.defineProperty(window.navigator, "serviceWorker", { configurable: true, value: container })
}

function delivered(id: string, category: string | null): FakeNotification {
  return { tag: id, data: { notificationId: id, category, link: null }, close: vi.fn() }
}

function row(id: string, read: boolean): NotificationDTO {
  return {
    id,
    type: "report_update",
    title: id,
    body: null,
    read,
    createdAt: "2026-10-01T00:00:00.000Z",
    link: null,
  }
}

type AuthStore = typeof AuthStoreModule.useAuthStore
let authStore: AuthStore | null = null

// The VAPID key is read once per page, so every case loads the modules afresh, the auth store with them.
async function startSignedIn(): Promise<() => void> {
  vi.resetModules()
  authStore = (await import("@/store/auth-store")).useAuthStore
  authStore.getState().setSession({ user: USER, csrfToken: "csrf-a" })
  const { installWebPush } = await import("./web-push")
  return installWebPush()
}

let uninstall: (() => void) | null = null

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset()
  api.getPushWebConfig.mockResolvedValue({ vapidPublicKey: VAPID_KEY })
  api.registerPush.mockResolvedValue({ ok: true })
  api.pushUnregister.mockResolvedValue({ ok: true })
  api.markNotificationsRead.mockResolvedValue({ ok: true })
  api.listNotifications.mockResolvedValue({ items: [], nextCursor: null })
  pushManager.getSubscription.mockClear()
  pushManager.subscribe.mockClear()
  registration.getNotifications.mockClear()
  browser.subscription = null
  browser.delivered = []
  window.localStorage.clear()
  window.history.replaceState(null, "", "/")
})

afterEach(() => {
  cleanup()
  uninstall?.()
  uninstall = null
  authStore?.getState().clear()
  authStore = null
  vi.unstubAllGlobals()
})

describe("starting web push", () => {
  it("T3: registers /sw.js once, with scope /, when the browser supports push", async () => {
    stubBrowser("default")
    uninstall = await startSignedIn()

    await vi.waitFor(() => expect(container.register).toHaveBeenCalled())
    expect(container.register).toHaveBeenCalledTimes(1)
    expect(container.register).toHaveBeenCalledWith("/sw.js", { scope: "/" })
  })
})

describe("the page side of a notification click", () => {
  it("T10: the worker's message naming n1 marks n1 read, once", async () => {
    stubBrowser("default")
    uninstall = await startSignedIn()
    await vi.waitFor(() => expect(container.register).toHaveBeenCalled())

    const tab = fakeWindowClient(window.location.href)
    const worker = loadServiceWorker(window.location.origin, [tab])
    await worker.click({ notificationId: "n1", category: "reportUpdates", link: "/reports/r1" })
    expect(tab.postMessage).toHaveBeenCalled()
    for (const [message] of tab.postMessage.mock.calls) {
      container.dispatchEvent(new MessageEvent("message", { data: message }))
    }

    await vi.waitFor(() => expect(api.markNotificationsRead).toHaveBeenCalled())
    expect(api.markNotificationsRead).toHaveBeenCalledTimes(1)
    expect(api.markNotificationsRead).toHaveBeenCalledWith({ ids: ["n1"] })
  })

  it("T10: a page loaded from the URL the worker opened marks n1 read, once", async () => {
    stubBrowser("default")
    const worker = loadServiceWorker(window.location.origin)
    await worker.click({ notificationId: "n1", category: "reportUpdates", link: "/reports/r1" })
    const opened = new URL(worker.openWindow.mock.calls[0]![0], window.location.origin)
    window.history.replaceState(null, "", opened.pathname + opened.search + opened.hash)

    uninstall = await startSignedIn()

    await vi.waitFor(() => expect(api.markNotificationsRead).toHaveBeenCalled())
    expect(api.markNotificationsRead).toHaveBeenCalledTimes(1)
    expect(api.markNotificationsRead).toHaveBeenCalledWith({ ids: ["n1"] })
  })
})

describe("a clicked notification's page, with the real shell mounted", () => {
  // As in the app: the providers import the push module, the shell mounts and writes its own URL (dropping
  // the query), and only then does the providers' effect start web push.
  async function loadThroughShell(url: URL) {
    window.history.replaceState(null, "", url.pathname + url.search + url.hash)
    vi.resetModules()
    authStore = (await import("@/store/auth-store")).useAuthStore
    const { installWebPush } = await import("./web-push")
    const { useWebNavAdapter } = await import("@/components/home/use-web-nav-adapter")
    function Shell() {
      useWebNavAdapter()
      return null
    }
    render(<Shell />)
    expect(window.location.search).not.toContain("readNotification")
    authStore.getState().setSession({ user: USER, csrfToken: "csrf-a" })
    uninstall = installWebPush()
  }

  it("marks n1 read on the page the worker opened (T7's URL)", async () => {
    stubBrowser("default")
    const worker = loadServiceWorker(window.location.origin)
    await worker.click({ notificationId: "n1", category: "reportUpdates", link: "/reports/r1" })

    await loadThroughShell(new URL(worker.openWindow.mock.calls[0]![0], window.location.origin))

    await vi.waitFor(() => expect(api.markNotificationsRead).toHaveBeenCalled())
    expect(api.markNotificationsRead).toHaveBeenCalledTimes(1)
    expect(api.markNotificationsRead).toHaveBeenCalledWith({ ids: ["n1"] })
  })

  it("marks n1 read once on the page the worker navigated a tab to (T6's path), message included", async () => {
    stubBrowser("default")
    const tab = fakeWindowClient(`${window.location.origin}/`)
    const worker = loadServiceWorker(window.location.origin, [tab])
    await worker.click({ notificationId: "n1", category: "reportUpdates", link: "/reports/r1" })

    await loadThroughShell(
      new URL(tab.navigate.mock.calls[0]![0] as string, window.location.origin),
    )
    for (const [message] of tab.postMessage.mock.calls) {
      container.dispatchEvent(new MessageEvent("message", { data: message }))
    }

    await vi.waitFor(() => expect(api.markNotificationsRead).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(api.markNotificationsRead).toHaveBeenCalledTimes(1)
    expect(api.markNotificationsRead).toHaveBeenCalledWith({ ids: ["n1"] })
  })
})

describe("the web push sync", () => {
  it("T13: with permission granted and a key, subscribes for visible pushes and registers the subscription", async () => {
    stubBrowser("granted")
    uninstall = await startSignedIn()

    await vi.waitFor(() => expect(api.registerPush).toHaveBeenCalled())
    expect(pushManager.subscribe).toHaveBeenCalledTimes(1)
    const [options] = pushManager.subscribe.mock.calls[0]!
    expect(options.userVisibleOnly).toBe(true)
    expect(new Uint8Array(options.applicationServerKey)).toEqual(VAPID_KEY_BYTES)
    expect(api.registerPush).toHaveBeenCalledTimes(1)
    expect(api.registerPush).toHaveBeenCalledWith({
      platform: "web",
      token: JSON.stringify(browser.subscription),
    })
  })

  for (const [label, permission, key] of [
    ["denied", "denied", VAPID_KEY],
    ["undetermined", "default", VAPID_KEY],
    ["a null key", "granted", null],
  ] as const) {
    it(`T14: ${label} never subscribes or registers`, async () => {
      stubBrowser(permission)
      api.getPushWebConfig.mockResolvedValue({ vapidPublicKey: key })
      uninstall = await startSignedIn()

      await vi.waitFor(() => expect(api.getPushWebConfig).toHaveBeenCalled())
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(pushManager.subscribe).not.toHaveBeenCalled()
      expect(api.registerPush).not.toHaveBeenCalled()
    })
  }

  it("T15: a CONFLICT unsubscribes, subscribes again and registers the new subscription", async () => {
    stubBrowser("granted")
    const tokens: string[] = []
    api.registerPush.mockImplementation(async ({ token }) => {
      tokens.push(token)
      if (tokens.length === 1)
        throw new AppError(ErrorCode.CONFLICT, "token owned by another account", {
          httpStatus: 409,
        })
      return { ok: true }
    })
    uninstall = await startSignedIn()

    await vi.waitFor(() => expect(api.registerPush).toHaveBeenCalledTimes(2))
    const first = pushManager.subscribe.mock.results[0]!.value as Promise<FakeSubscription>
    const second = pushManager.subscribe.mock.results[1]!.value as Promise<FakeSubscription>
    const [firstSubscription, secondSubscription] = await Promise.all([first, second])
    expect(firstSubscription.unsubscribe).toHaveBeenCalledTimes(1)
    expect(firstSubscription.unsubscribe.mock.invocationCallOrder[0]!).toBeLessThan(
      pushManager.subscribe.mock.invocationCallOrder[1]!,
    )
    expect(pushManager.subscribe).toHaveBeenCalledTimes(2)
    expect(tokens).toEqual([JSON.stringify(firstSubscription), JSON.stringify(secondSubscription)])
    expect(tokens[0]).not.toBe(tokens[1])
  })

  it("T16: a second CONFLICT stops: no third subscribe or register", async () => {
    stubBrowser("granted")
    api.registerPush.mockRejectedValue(
      new AppError(ErrorCode.CONFLICT, "token owned by another account", { httpStatus: 409 }),
    )
    uninstall = await startSignedIn()

    await vi.waitFor(() => expect(api.registerPush).toHaveBeenCalledTimes(2))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(pushManager.subscribe).toHaveBeenCalledTimes(2)
    expect(api.registerPush).toHaveBeenCalledTimes(2)
  })

  it("T26: a sign-out by any other path (a 401) unsubscribes the browser without pushUnregister", async () => {
    stubBrowser("granted")
    uninstall = await startSignedIn()
    await vi.waitFor(() => expect(api.registerPush).toHaveBeenCalled())
    const subscription = browser.subscription!

    authStore!.getState().clear()

    await vi.waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalled())
    expect(api.pushUnregister).not.toHaveBeenCalled()
  })
})

describe("closing read notifications when the tab gains focus", () => {
  function deliverT21() {
    browser.delivered = [
      delivered("n1", "reportUpdates"),
      delivered("n2", "events"),
      delivered("n3", "directMessages"),
      delivered("n4", "groupChats"),
      delivered("n5", "reportDiscussions"),
      delivered("n6", null),
    ]
  }

  async function startAndSettle() {
    uninstall = await startSignedIn()
    await vi.waitFor(() => expect(container.register).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 20))
    for (const notification of browser.delivered) notification.close.mockClear()
    api.listNotifications.mockClear()
  }

  it("T21: closes the read and missing notifications-page ones, never a chat one", async () => {
    stubBrowser("granted")
    await startAndSettle()
    deliverT21()
    api.listNotifications.mockResolvedValue({
      items: [row("n1", true), row("n2", false), row("n3", true)],
      nextCursor: null,
    })

    window.dispatchEvent(new Event("focus"))

    const [n1, n2, n3, n4, n5, n6] = browser.delivered
    await vi.waitFor(() => expect(n1!.close).toHaveBeenCalled())
    await vi.waitFor(() => expect(n6!.close).toHaveBeenCalled())
    expect(api.listNotifications).toHaveBeenCalledTimes(1)
    expect(api.listNotifications.mock.calls[0]![0]).not.toHaveProperty("cursor")
    for (const kept of [n2, n3, n4, n5]) expect(kept!.close).not.toHaveBeenCalled()
  })

  it("T22: closes nothing when the list cannot be read", async () => {
    stubBrowser("granted")
    await startAndSettle()
    deliverT21()
    api.listNotifications.mockRejectedValue(new TypeError("Failed to fetch"))

    window.dispatchEvent(new Event("focus"))

    await vi.waitFor(() => expect(api.listNotifications).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 20))
    for (const notification of browser.delivered) expect(notification.close).not.toHaveBeenCalled()
  })
})
