import { beforeEach, describe, expect, it, vi } from "vitest"

import { ChatSocketCore } from "../chatSocketCore"
import type { WsConnection, WsTransport } from "../types"

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  sent: string[] = []
  closed = false
  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
  }
  send(data: string): void {
    this.sent.push(data)
  }
  close(): void {
    this.readyState = 3
    this.closed = true
  }
  fireOpen(): void {
    this.readyState = 1
    this.onopen?.()
  }
  fireMessage(data: unknown): void {
    this.onmessage?.({ data })
  }
  fireClose(): void {
    this.readyState = 3
    this.onclose?.()
  }
  parsedSent(): Array<Record<string, unknown>> {
    return this.sent.map((s) => JSON.parse(s) as Record<string, unknown>)
  }
}

const ROOM_A = "11111111-1111-4111-8111-111111111111"
const ROOM_B = "22222222-2222-4222-8222-222222222222"

function latest(): FakeWebSocket {
  const s = FakeWebSocket.instances.at(-1)
  if (!s) throw new Error("no socket constructed")
  return s
}

function syncTransport(available: () => boolean = () => true): WsTransport {
  return {
    open: (): WsConnection | null =>
      available() ? { socket: new FakeWebSocket("ws://test/ws") as unknown as WebSocket } : null,
  }
}

beforeEach(() => {
  FakeWebSocket.instances = []
})

describe("lifecycle", () => {
  it("connect() opens exactly one socket; disconnect() closes it", () => {
    const socket = new ChatSocketCore({ transport: syncTransport() })
    socket.connect()
    expect(FakeWebSocket.instances).toHaveLength(1)
    latest().fireOpen()
    expect(socket.getStatus()).toBe("open")

    socket.disconnect()
    expect(latest().closed).toBe(true)
    expect(socket.getStatus()).toBe("closed")
  })

  it("connect() is idempotent: a second connect() does not open a second socket", () => {
    const socket = new ChatSocketCore({ transport: syncTransport() })
    socket.connect()
    latest().fireOpen()
    socket.connect()
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it("onStatus emits the current status immediately and on every transition", () => {
    const socket = new ChatSocketCore({ transport: syncTransport() })
    const seen: string[] = []
    socket.onStatus((s) => seen.push(s))
    socket.connect()
    latest().fireOpen()
    socket.disconnect()
    expect(seen).toEqual(["closed", "connecting", "open", "closed"])
  })

  it("initialStatus lets a host report the mobile legacy 'idle' as connecting", () => {
    const socket = new ChatSocketCore({ transport: syncTransport(), initialStatus: "connecting" })
    expect(socket.getStatus()).toBe("connecting")
  })
})

describe("teardownPolicy", () => {
  it("'intent' (web): release() does not tear down a socket the always-on channel still wants", () => {
    const socket = new ChatSocketCore({ transport: syncTransport() })
    socket.connect()
    socket.retain()
    latest().fireOpen()
    socket.release()
    expect(latest().closed).toBe(false)
    expect(socket.getStatus()).toBe("open")
  })

  it("'intent': disconnect() leaves the socket up while a chat screen holds it", () => {
    const socket = new ChatSocketCore({ transport: syncTransport() })
    socket.retain()
    latest().fireOpen()
    socket.disconnect()
    expect(latest().closed).toBe(false)
    socket.release()
    expect(latest().closed).toBe(true)
  })

  it("'eager' (mobile): the last release() tears the socket down outright", () => {
    const socket = new ChatSocketCore({ transport: syncTransport(), teardownPolicy: "eager" })
    socket.connect()
    socket.retain()
    latest().fireOpen()
    socket.release()
    expect(latest().closed).toBe(true)
    expect(socket.getStatus()).toBe("closed")
  })
})

describe("rooms", () => {
  it("joins desired rooms on open and re-joins them on reconnect", () => {
    const socket = new ChatSocketCore({ transport: syncTransport() })
    socket.connect()
    socket.join(ROOM_A, "cleanup")
    socket.join(ROOM_B, "dm")
    const first = latest()
    first.fireOpen()
    expect(first.parsedSent()).toEqual([
      { type: "join", cleanupId: ROOM_A },
      { type: "join", cleanupId: ROOM_B, roomKind: "dm" },
    ])

    first.fireClose()
    socket.connect()
    const second = latest()
    second.fireOpen()
    expect(second.parsedSent()).toHaveLength(2)
  })

  it("a REJECTED room is excluded from the auto-rejoin, and rejection is keyed by room KIND", () => {
    const socket = new ChatSocketCore({ transport: syncTransport() })
    socket.connect()
    socket.join(ROOM_A, "dm")
    latest().fireOpen()
    socket.markRoomRejected(ROOM_A, "dm")
    expect(socket.isRoomRejected(ROOM_A, "dm")).toBe(true)
    expect(socket.isRoomRejected(ROOM_A, "cleanup")).toBe(false)

    latest().fireClose()
    socket.connect()
    const second = latest()
    second.fireOpen()
    expect(second.parsedSent()).toEqual([])
  })

  it("leave() stops the room from being re-joined and clears its rejection", () => {
    const socket = new ChatSocketCore({ transport: syncTransport() })
    socket.connect()
    socket.join(ROOM_A, "cleanup")
    latest().fireOpen()
    socket.markRoomRejected(ROOM_A, "cleanup")
    socket.leave(ROOM_A, "cleanup")
    expect(socket.isRoomRejected(ROOM_A, "cleanup")).toBe(false)
    latest().fireClose()
    socket.connect()
    latest().fireOpen()
    expect(latest().parsedSent()).toEqual([])
  })
})

describe("send", () => {
  it("queueWhileClosed (web): frames sent while down report 'queued' and are flushed IN ORDER on the next open", () => {
    const socket = new ChatSocketCore({ transport: syncTransport(), queueWhileClosed: true })
    socket.connect()
    expect(socket.send({ type: "typing", cleanupId: ROOM_A })).toBe("queued")
    expect(socket.send({ type: "typing", cleanupId: ROOM_B })).toBe("queued")
    const s = latest()
    expect(s.sent).toEqual([])
    s.fireOpen()
    expect(s.parsedSent()).toEqual([
      { type: "typing", cleanupId: ROOM_A },
      { type: "typing", cleanupId: ROOM_B },
    ])
  })

  it("without queueWhileClosed (mobile): a send while down is 'dropped', one while open is 'sent'", () => {
    const socket = new ChatSocketCore({ transport: syncTransport() })
    socket.connect()
    expect(socket.send({ type: "typing", cleanupId: ROOM_A })).toBe("dropped")
    latest().fireOpen()
    expect(latest().sent).toEqual([])
    expect(socket.send({ type: "typing", cleanupId: ROOM_A })).toBe("sent")
  })

  it("an invalid outbound frame is 'dropped', never written and never queued", () => {
    const onInvalidFrame = vi.fn()
    const socket = new ChatSocketCore({
      transport: syncTransport(),
      queueWhileClosed: true,
      onInvalidFrame,
    })
    socket.connect()
    latest().fireOpen()
    expect(socket.send({ type: "send", cleanupId: "not-a-uuid", clientId: "", body: "" })).toBe(
      "dropped",
    )
    expect(latest().sent).toEqual([])
    expect(onInvalidFrame).toHaveBeenCalledWith("outbound", expect.anything())
  })

  it("a queued frame SURVIVES a close->reopen cycle and flushes after the auto-rejoins", () => {
    const socket = new ChatSocketCore({ transport: syncTransport(), queueWhileClosed: true })
    socket.connect()
    socket.join(ROOM_A, "cleanup")
    const first = latest()
    first.fireOpen()
    first.fireClose()

    expect(socket.send({ type: "typing", cleanupId: ROOM_A })).toBe("queued")
    socket.connect()
    const second = latest()
    second.fireOpen()
    expect(second.parsedSent()).toEqual([
      { type: "join", cleanupId: ROOM_A },
      { type: "typing", cleanupId: ROOM_A },
    ])
  })

  it("eager teardown (last release) WIPES the queue: queued frames do not resurface on a later open", () => {
    const socket = new ChatSocketCore({
      transport: syncTransport(),
      queueWhileClosed: true,
      teardownPolicy: "eager",
    })
    socket.retain()
    expect(socket.send({ type: "typing", cleanupId: ROOM_A })).toBe("queued")
    socket.release()

    socket.retain()
    latest().fireOpen()
    expect(latest().sent).toEqual([])
  })
})

describe("inbound frames", () => {
  it("delivers validated frames and drops unknown/invalid ones (forward-compat)", () => {
    const socket = new ChatSocketCore({ transport: syncTransport() })
    socket.connect()
    latest().fireOpen()
    const received: unknown[] = []
    socket.subscribe((frame) => received.push(frame))

    latest().fireMessage(JSON.stringify({ type: "signal", topic: "threads" }))
    latest().fireMessage(JSON.stringify({ type: "totally_unknown", whatever: 1 }))
    latest().fireMessage("not json at all")

    expect(received).toEqual([{ type: "signal", topic: "threads" }])
  })

  it("delivers the feed signal topics and drops a topic this client predates", () => {
    const socket = new ChatSocketCore({ transport: syncTransport() })
    socket.connect()
    latest().fireOpen()
    const received: unknown[] = []
    socket.subscribe((frame) => received.push(frame))

    latest().fireMessage(JSON.stringify({ type: "signal", topic: "feed", id: ROOM_A }))
    latest().fireMessage(JSON.stringify({ type: "signal", topic: "feed_counts", id: ROOM_B }))
    latest().fireMessage(JSON.stringify({ type: "signal", topic: "feed_v2", id: ROOM_A }))

    expect(received).toEqual([
      { type: "signal", topic: "feed", id: ROOM_A },
      { type: "signal", topic: "feed_counts", id: ROOM_B },
    ])
  })

  it("a throwing listener does not take down the socket or its siblings", () => {
    const socket = new ChatSocketCore({ transport: syncTransport() })
    socket.connect()
    latest().fireOpen()
    const calls: string[] = []
    socket.subscribe(() => {
      throw new Error("boom")
    })
    socket.subscribe(() => calls.push("ok"))
    latest().fireMessage(JSON.stringify({ type: "signal", topic: "threads" }))
    expect(calls).toEqual(["ok"])
  })
})

describe("transport unavailable", () => {
  it("retryWhenUnavailable:false (web) goes closed without scheduling a retry", () => {
    vi.useFakeTimers()
    try {
      const socket = new ChatSocketCore({ transport: syncTransport(() => false) })
      socket.connect()
      expect(FakeWebSocket.instances).toHaveLength(0)
      expect(socket.getStatus()).toBe("closed")
      vi.advanceTimersByTime(60_000)
      expect(FakeWebSocket.instances).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it("retryWhenUnavailable:true (mobile) backs off and retries once the transport recovers", () => {
    vi.useFakeTimers()
    try {
      let ready = false
      const socket = new ChatSocketCore({
        transport: syncTransport(() => ready),
        retryWhenUnavailable: true,
        statusWhileBackingOff: "closed",
      })
      socket.connect()
      expect(FakeWebSocket.instances).toHaveLength(0)
      expect(socket.getStatus()).toBe("closed")
      ready = true
      vi.advanceTimersByTime(60_000)
      expect(FakeWebSocket.instances).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("identity guard", () => {
  it("recreates the socket when the auth identity changed under a live one", async () => {
    let key = "token-a"
    const transport: WsTransport = {
      open: () =>
        Promise.resolve({
          socket: new FakeWebSocket("ws://test/ws") as unknown as WebSocket,
          authKey: key,
        }),
      authKey: () => Promise.resolve(key),
    }
    const socket = new ChatSocketCore({ transport })
    socket.connect()
    await Promise.resolve()
    await Promise.resolve()
    latest().fireOpen()
    expect(FakeWebSocket.instances).toHaveLength(1)

    socket.connect()
    await Promise.resolve()
    await Promise.resolve()
    expect(FakeWebSocket.instances).toHaveLength(1)

    key = "token-b"
    socket.connect()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(FakeWebSocket.instances[0]!.closed).toBe(true)
  })
})

describe("suspend / resume (app background)", () => {
  it("suspend() drops the socket without scheduling a reconnect; resume() reopens and re-joins", () => {
    vi.useFakeTimers()
    try {
      const socket = new ChatSocketCore({ transport: syncTransport(), teardownPolicy: "eager" })
      socket.retain()
      socket.join(ROOM_A, "dm")
      latest().fireOpen()

      socket.suspend()
      expect(FakeWebSocket.instances[0]!.closed).toBe(true)
      expect(socket.getStatus()).toBe("closed")
      vi.advanceTimersByTime(60_000)
      expect(FakeWebSocket.instances).toHaveLength(1)

      socket.resume()
      expect(FakeWebSocket.instances).toHaveLength(2)
      latest().fireOpen()
      expect(latest().parsedSent()).toEqual([{ type: "join", cleanupId: ROOM_A, roomKind: "dm" }])
    } finally {
      vi.useRealTimers()
    }
  })
})

function deferredTransport() {
  const attempts: Array<{
    resolve: (connection: WsConnection | null) => void
    reject: (reason: unknown) => void
  }> = []
  const transport: WsTransport = {
    open: () =>
      new Promise<WsConnection | null>((resolve, reject) => {
        attempts.push({ resolve, reject })
      }),
  }
  return { transport, attempts }
}

async function settle(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe("in-flight connect generation guard", () => {
  it("a connection resolving after suspend() is closed, never adopted", async () => {
    const { transport, attempts } = deferredTransport()
    const core = new ChatSocketCore({ transport, teardownPolicy: "eager" })
    core.retain()
    expect(attempts).toHaveLength(1)

    core.suspend()
    const stale = new FakeWebSocket("ws://test/ws")
    attempts[0]!.resolve({ socket: stale as unknown as WebSocket })
    await settle()

    expect(stale.closed).toBe(true)
    expect(stale.onmessage).toBeNull()
    expect(core.getStatus()).toBe("closed")
  })

  it("suspend()+resume() during an in-flight connect adopts only the new socket (no orphan on double-adopt)", async () => {
    const { transport, attempts } = deferredTransport()
    const core = new ChatSocketCore({ transport, teardownPolicy: "eager" })
    core.retain()
    core.join(ROOM_A, "dm")

    core.suspend()
    core.resume()
    expect(attempts).toHaveLength(2)

    const stale = new FakeWebSocket("ws://test/ws")
    attempts[0]!.resolve({ socket: stale as unknown as WebSocket })
    await settle()
    expect(stale.closed).toBe(true)
    expect(stale.onmessage).toBeNull()

    const fresh = new FakeWebSocket("ws://test/ws")
    attempts[1]!.resolve({ socket: fresh as unknown as WebSocket })
    await settle()
    fresh.fireOpen()

    expect(core.getStatus()).toBe("open")
    expect(fresh.closed).toBe(false)
    expect(fresh.parsedSent()).toEqual([{ type: "join", cleanupId: ROOM_A, roomKind: "dm" }])

    const received: unknown[] = []
    core.subscribe((frame) => received.push(frame))
    stale.fireMessage(JSON.stringify({ type: "signal", topic: "threads" }))
    expect(received).toEqual([])
    fresh.fireMessage(JSON.stringify({ type: "signal", topic: "threads" }))
    expect(received).toEqual([{ type: "signal", topic: "threads" }])
  })

  it("a stale rejection does not clobber a newer in-flight attempt", async () => {
    const { transport, attempts } = deferredTransport()
    const core = new ChatSocketCore({ transport, teardownPolicy: "eager" })
    core.retain()

    core.suspend()
    core.resume()
    expect(attempts).toHaveLength(2)

    attempts[0]!.reject(new Error("stale attempt"))
    await settle()

    const fresh = new FakeWebSocket("ws://test/ws")
    attempts[1]!.resolve({ socket: fresh as unknown as WebSocket })
    await settle()
    fresh.fireOpen()

    expect(core.getStatus()).toBe("open")
    expect(fresh.closed).toBe(false)
  })
})
