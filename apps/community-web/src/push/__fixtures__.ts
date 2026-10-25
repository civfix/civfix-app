import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { runInNewContext } from "node:vm"
import { vi } from "vitest"

// A path join rather than `new URL(…, import.meta.url)`: under jsdom that URL is jsdom's, which
// fileURLToPath rejects.
export const SW_SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../public/sw.js"),
  "utf8",
)

export interface FakeWindowClient {
  url: string
  focused: boolean
  focus: ReturnType<typeof vi.fn>
  navigate: ReturnType<typeof vi.fn>
  postMessage: ReturnType<typeof vi.fn>
}

export function fakeWindowClient(url: string): FakeWindowClient {
  const client: FakeWindowClient = {
    url,
    focused: false,
    focus: vi.fn(async () => client),
    navigate: vi.fn(async (to: string) => {
      client.url = to
      return client
    }),
    postMessage: vi.fn(),
  }
  return client
}

export interface FakeNotification {
  tag: string
  data: unknown
  close: ReturnType<typeof vi.fn>
}

type Listener = (event: unknown) => void

/** Evaluates public/sw.js against a fake `self`, the way a browser runs it in its own global scope. */
export function loadServiceWorker(origin: string, windows: FakeWindowClient[] = []) {
  const listeners = new Map<string, Listener[]>()
  const showNotification = vi.fn((_title: string, _options: object) => Promise.resolve())
  const openWindow = vi.fn(async (url: string) => fakeWindowClient(new URL(url, origin).href))
  const matchAll = vi.fn(async () => windows)
  const importScripts = vi.fn()
  const self = {
    addEventListener: vi.fn((type: string, listener: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener])
    }),
    registration: { showNotification },
    clients: { matchAll, openWindow, claim: vi.fn(async () => undefined) },
    location: new URL("/sw.js", origin),
    skipWaiting: vi.fn(async () => undefined),
  }
  runInNewContext(SW_SOURCE, { self, importScripts, URL, console })

  function dispatch(type: string, event: object): void {
    for (const listener of listeners.get(type) ?? []) listener(event)
  }

  function push(payload: unknown) {
    const waitUntil = vi.fn()
    dispatch("push", { data: { json: () => payload, text: () => JSON.stringify(payload) }, waitUntil })
    return { waitUntil }
  }

  async function click(data: unknown) {
    const notification: FakeNotification = { tag: "", data, close: vi.fn() }
    const waited: Promise<unknown>[] = []
    dispatch("notificationclick", {
      notification,
      action: "",
      waitUntil: (promise: Promise<unknown>) => waited.push(promise),
    })
    await Promise.all(waited)
    return { notification, waited }
  }

  return { self, listeners, importScripts, showNotification, openWindow, matchAll, push, click }
}
