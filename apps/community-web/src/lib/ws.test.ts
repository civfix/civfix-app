import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

import { chatSocket, wsUrlFromApiBase } from "@/lib/ws"

/**
 * The core's generic mechanics are tested once in @civfix/ui; these pin what only this host can get
 * wrong: the ws URL derivation, `queueWhileClosed` (flushed in order, including the stop-and-requeue on
 * a mid-flush failure) and `teardownPolicy: "intent"` (the socket is shared with the signals channel).
 *
 * The node env has no DOM, so `window.WebSocket` is a fake that records frames. `chatSocket` is a module
 * singleton, so afterEach disconnects it back to a clean state.
 */

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static OPEN = 1
  static CLOSED = 3
  readyState = 0 // CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  sent: string[] = []
  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
  }
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.readyState = FakeWebSocket.CLOSED
  }
  /** Test helper: drive the socket to OPEN and fire onopen (as the browser would). */
  fireOpen() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }
  /** Test helper: simulate an unexpected close. */
  fireClose() {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }
  /** All frames this socket sent, parsed. */
  parsedSent(): Array<Record<string, unknown>> {
    return this.sent.map((s) => JSON.parse(s) as Record<string, unknown>)
  }
}

const ROOM_A = "11111111-1111-4111-8111-111111111111"
const ROOM_B = "22222222-2222-4222-8222-222222222222"
const ROOM_C = "33333333-3333-4333-8333-333333333333"

/** The latest constructed fake socket. */
function latest(): FakeWebSocket {
  const s = FakeWebSocket.instances.at(-1)
  if (!s) throw new Error("no socket constructed")
  return s
}

beforeEach(() => {
  FakeWebSocket.instances = []
  // The transport reads `window.WebSocket` + `window.location.origin`; provide both.
  ;(globalThis as Record<string, unknown>).window = {
    WebSocket: FakeWebSocket,
    location: { origin: "http://localhost:3000" },
  }
})

afterEach(() => {
  // Return the singleton to a clean, torn-down state before clearing the global stubs.
  chatSocket.disconnect()
  delete (globalThis as Record<string, unknown>).window
  vi.restoreAllMocks()
})

describe("wsUrlFromApiBase", () => {
  it("maps http -> ws and https -> wss, appending /ws and preserving a base path", () => {
    expect(wsUrlFromApiBase("http://localhost:8080")).toBe("ws://localhost:8080/ws")
    expect(wsUrlFromApiBase("https://api.civfix.org")).toBe("wss://api.civfix.org/ws")
    expect(wsUrlFromApiBase("https://api.civfix.org/v1/")).toBe("wss://api.civfix.org/v1/ws")
    // A relative base resolves against the current origin.
    expect(wsUrlFromApiBase("/api")).toBe("ws://localhost:3000/api/ws")
  })

  it("returns '' without a window, so the export/prerender never opens a socket", () => {
    delete (globalThis as Record<string, unknown>).window
    expect(wsUrlFromApiBase("https://api.civfix.org")).toBe("")
    // And the socket stays inert rather than throwing or spinning a retry.
    chatSocket.connect()
    expect(FakeWebSocket.instances).toHaveLength(0)
    expect(chatSocket.getStatus()).toBe("closed")
  })
})

describe("chatSocket lifecycle", () => {
  it("connect() opens exactly one socket; disconnect() closes it", () => {
    chatSocket.connect()
    expect(FakeWebSocket.instances).toHaveLength(1)
    const socket = latest()
    socket.fireOpen()
    expect(chatSocket.getStatus()).toBe("open")

    chatSocket.disconnect()
    expect(socket.readyState).toBe(FakeWebSocket.CLOSED)
    expect(chatSocket.getStatus()).toBe("closed")
  })

  it("connect() is idempotent: a second connect() does not open a second socket", () => {
    chatSocket.connect()
    latest().fireOpen()
    chatSocket.connect()
    expect(FakeWebSocket.instances).toHaveLength(1)
  })
})

describe("chatSocket refcount vs always-on intent (teardownPolicy: intent)", () => {
  it("release() does not tear down a socket the realtime channel still wants", () => {
    chatSocket.connect() // realtime-channel intent
    chatSocket.retain() // a chat screen
    latest().fireOpen()
    const socket = latest()

    chatSocket.release() // chat screen gone, but connect() intent remains
    expect(socket.readyState).toBe(FakeWebSocket.OPEN)
    expect(chatSocket.getStatus()).toBe("open")
  })

  it("disconnect() keeps the socket while a chat screen still holds it (refCount > 0)", () => {
    chatSocket.retain()
    latest().fireOpen()
    const socket = latest()

    chatSocket.disconnect() // realtime channel went anonymous, but a room is still open
    expect(socket.readyState).toBe(FakeWebSocket.OPEN)

    chatSocket.release() // last holder gone -> torn down
    expect(socket.readyState).toBe(FakeWebSocket.CLOSED)
  })
})

describe("chatSocket send queue (queueWhileClosed)", () => {
  it("queues a frame sent while the socket is down and flushes it on open", () => {
    chatSocket.connect()
    const socket = latest()
    // Not open yet: the chat message is queued (no throw, nothing sent). Typing frames are ephemeral
    // and dropped while closed, so a real message is what exercises the queue.
    chatSocket.send({ type: "send", cleanupId: ROOM_A, clientId: "c1", body: "hi" })
    expect(socket.sent).toHaveLength(0)

    socket.fireOpen()
    expect(socket.parsedSent().some((f) => f.type === "send" && f.cleanupId === ROOM_A)).toBe(true)
  })

  it("preserves frame ORDER when a send fails partway through the flush", () => {
    chatSocket.connect()
    const first = latest()
    // Three frames queued while the socket is down, in the order the user produced them.
    chatSocket.send({ type: "send", cleanupId: ROOM_A, clientId: "a", body: "1" })
    chatSocket.send({ type: "send", cleanupId: ROOM_B, clientId: "b", body: "2" })
    chatSocket.send({ type: "send", cleanupId: ROOM_C, clientId: "c", body: "3" })

    // The SECOND send throws (the socket flipped to CLOSING mid-flush). The flush must stop there
    // rather than carrying on to the third frame: delivering C while B goes back on the queue would put
    // the room's messages in a different order than the user sent them.
    let sends = 0
    first.send = (data: string) => {
      sends += 1
      if (sends === 2) throw new Error("InvalidStateError: socket is CLOSING")
      first.sent.push(data)
    }
    first.fireOpen()
    expect(first.parsedSent().map((f) => f.cleanupId)).toEqual([ROOM_A])

    // Reconnect: the untouched tail replays in its ORIGINAL order (B before C).
    vi.useFakeTimers()
    first.fireClose()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()

    const second = latest()
    second.fireOpen()
    expect(second.parsedSent().map((f) => f.cleanupId)).toEqual([ROOM_B, ROOM_C])
  })
})
