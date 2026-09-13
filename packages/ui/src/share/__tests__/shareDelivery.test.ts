import { beforeEach, describe, expect, it, vi } from "vitest"
import type { WsClientMessage, WsServerMessage } from "@civfix/shared"
import type { ChatConnState, ChatSendResult, ChatSocketLike } from "../../data/types"
import { runShareToDm } from "../shareDelivery"
import { buildSharePlan, type SharePlanEntry } from "../shareToDm"

const ACK_MS = 40
const OPEN_MS = 20

type SendBehaviour = "ack" | "silence" | "error" | "transport-error" | "dropped"

class FakeSocket implements ChatSocketLike {
  retained = 0
  released = 0
  joined: string[] = []
  left: string[] = []
  sent: WsClientMessage[] = []
  status: ChatConnState
  behaviour: SendBehaviour | ((index: number) => SendBehaviour)
  private readonly frameListeners = new Set<(frame: WsServerMessage) => void>()
  private readonly statusListeners = new Set<(status: ChatConnState) => void>()

  constructor(status: ChatConnState = "open", behaviour: FakeSocket["behaviour"] = "ack") {
    this.status = status
    this.behaviour = behaviour
  }

  retain(): void {
    this.retained += 1
  }
  release(): void {
    this.released += 1
  }
  join(roomId: string): void {
    this.joined.push(roomId)
  }
  leave(roomId: string): void {
    this.left.push(roomId)
  }
  markRoomRejected(): void {}
  getStatus(): ChatConnState {
    return this.status
  }
  onStatus(handler: (status: ChatConnState) => void): () => void {
    this.statusListeners.add(handler)
    handler(this.status)
    return () => this.statusListeners.delete(handler)
  }
  subscribe(handler: (frame: WsServerMessage) => void): () => void {
    this.frameListeners.add(handler)
    return () => this.frameListeners.delete(handler)
  }
  get subscriberCount(): number {
    return this.frameListeners.size
  }

  open(): void {
    this.status = "open"
    for (const listener of [...this.statusListeners]) listener("open")
  }

  send(frame: WsClientMessage): ChatSendResult {
    this.sent.push(frame)
    const index = this.sent.length - 1
    const behaviour = typeof this.behaviour === "function" ? this.behaviour(index) : this.behaviour
    if (behaviour === "dropped") return "dropped"
    if (frame.type !== "send") return "sent"
    const { clientId, cleanupId } = frame
    if (behaviour === "ack") {
      queueMicrotask(() => this.emitAck(clientId, cleanupId))
    } else if (behaviour === "error") {
      queueMicrotask(() => this.emitError(cleanupId))
    } else if (behaviour === "transport-error") {
      queueMicrotask(() => this.emitTransportError())
    }
    return "sent"
  }

  emitAck(clientId: string, roomId: string): void {
    this.emit({
      type: "ack",
      clientId,
      message: { id: `m-${clientId}`, cleanupId: roomId } as never,
    })
  }

  emitError(roomId: string): void {
    this.emit({ type: "error", code: "FORBIDDEN", message: "nope", cleanupId: roomId })
  }

  emitTransportError(): void {
    this.emit({ type: "error", code: "RATE_LIMITED", message: "slow down" })
  }

  private emit(frame: WsServerMessage): void {
    for (const listener of [...this.frameListeners]) listener(frame)
  }
}

const plan = (count: number): SharePlanEntry[] =>
  buildSharePlan(
    Array.from({ length: count }, (_, i) => ({ id: `u${i}`, name: `Name ${i}` })),
    (i) => `cid-${i}`,
  )

const room = (recipientId: string): Promise<string | null> =>
  Promise.resolve(`room-${recipientId}`)

const run = (socket: ChatSocketLike, entries: SharePlanEntry[], over = {}) =>
  runShareToDm(
    { socket, resolveRoom: room, ackTimeoutMs: ACK_MS, openTimeoutMs: OPEN_MS, ...over },
    { entries, body: "https://civfix.org/post/p1" },
  )

beforeEach(() => {
  vi.useRealTimers()
})

describe("a delivered run", () => {
  it("sends one frame per recipient and scores each ack", async () => {
    const socket = new FakeSocket()
    const entries = plan(3)
    const { summary, rooms } = await run(socket, entries)

    expect(summary.status).toBe("all")
    expect(summary.stopped).toBe(false)
    expect(rooms).toEqual(["room-u0", "room-u1", "room-u2"])
    expect(socket.sent.map((frame) => frame.type)).toEqual(["send", "send", "send"])
    expect(socket.sent[0]).toMatchObject({
      cleanupId: "room-u0",
      roomKind: "dm",
      clientId: "cid-0",
      body: "https://civfix.org/post/p1",
    })
  })

  it("never joins or leaves the room, so an open conversation is not evicted", async () => {
    const socket = new FakeSocket()
    await run(socket, plan(2))
    expect(socket.joined).toEqual([])
    expect(socket.left).toEqual([])
  })

  it("retains the socket exactly once and always releases it", async () => {
    const socket = new FakeSocket()
    await run(socket, plan(2))
    expect(socket.retained).toBe(1)
    expect(socket.released).toBe(1)
    expect(socket.subscriberCount).toBe(0)
  })

  it("waits for a connecting socket to open", async () => {
    const socket = new FakeSocket("connecting")
    const promise = run(socket, plan(1))
    socket.open()
    const { summary } = await promise
    expect(summary.status).toBe("all")
  })
})

describe("a per-recipient refusal keeps the run going", () => {
  it("continues past an unopenable thread", async () => {
    const socket = new FakeSocket()
    const entries = plan(3)
    const { summary } = await runShareToDm(
      {
        socket,
        resolveRoom: (id) => Promise.resolve(id === "u1" ? null : `room-${id}`),
        ackTimeoutMs: ACK_MS,
        openTimeoutMs: OPEN_MS,
      },
      { entries, body: "b" },
    )
    expect(summary.status).toBe("partial")
    expect(summary.failed.map((r) => r.id)).toEqual(["u1"])
    expect(summary.stopped).toBe(false)
    expect(socket.sent).toHaveLength(2)
  })

  it("continues past an explicit server error frame for that room", async () => {
    const socket = new FakeSocket("open", (index) => (index === 0 ? "error" : "ack"))
    const entries = plan(3)
    const { summary } = await run(socket, entries)
    expect(summary.failed.map((r) => r.id)).toEqual(["u0"])
    expect(summary.sent.map((r) => r.id)).toEqual(["u1", "u2"])
    expect(summary.stopped).toBe(false)
    expect(socket.sent).toHaveLength(3)
  })
})

describe("a transport failure STOPS the run instead of timing out per recipient", () => {
  it("stops on a missing ack rather than paying the timeout ten times", async () => {
    const socket = new FakeSocket("open", (index) => (index === 0 ? "ack" : "silence"))
    const entries = plan(4)
    const started = Date.now()
    const { summary } = await run(socket, entries)

    expect(socket.sent).toHaveLength(2)
    expect(summary.stopped).toBe(true)
    expect(summary.status).toBe("partial")
    expect(summary.sent.map((r) => r.id)).toEqual(["u0"])
    expect(summary.failed.map((r) => r.id)).toEqual(["u1", "u2", "u3"])
    expect(Date.now() - started).toBeLessThan(ACK_MS * 3)
  })

  it("stops at once on a server error frame that names no room", async () => {
    const socket = new FakeSocket("open", (index) => (index === 0 ? "ack" : "transport-error"))
    const entries = plan(4)
    const started = Date.now()
    const { summary } = await run(socket, entries)

    expect(socket.sent).toHaveLength(2)
    expect(summary.stopped).toBe(true)
    expect(summary.sent.map((r) => r.id)).toEqual(["u0"])
    expect(summary.failed.map((r) => r.id)).toEqual(["u1", "u2", "u3"])
    expect(Date.now() - started).toBeLessThan(ACK_MS)
  })

  it("stops when the socket drops the frame", async () => {
    const socket = new FakeSocket("open", "dropped")
    const { summary } = await run(socket, plan(3))
    expect(socket.sent).toHaveLength(1)
    expect(summary.status).toBe("none")
    expect(summary.stopped).toBe(true)
    expect(socket.released).toBe(1)
    expect(socket.subscriberCount).toBe(0)
  })

  it("stops when the socket never opens, before any frame is written", async () => {
    const socket = new FakeSocket("closed")
    const { summary } = await run(socket, plan(3))
    expect(socket.sent).toEqual([])
    expect(summary.status).toBe("none")
    expect(summary.stopped).toBe(true)
    expect(summary.failed).toHaveLength(3)
    expect(socket.released).toBe(1)
  })
})

describe("the run is abortable", () => {
  it("stops before the next send and keeps what already went out", async () => {
    const socket = new FakeSocket()
    let aborted = false
    const entries = plan(4)
    const { summary } = await runShareToDm(
      {
        socket,
        resolveRoom: (id) => {
          if (id === "u2") aborted = true
          return Promise.resolve(`room-${id}`)
        },
        ackTimeoutMs: ACK_MS,
        openTimeoutMs: OPEN_MS,
        isAborted: () => aborted,
      },
      { entries, body: "b" },
    )
    expect(socket.sent).toHaveLength(2)
    expect(summary.sent.map((r) => r.id)).toEqual(["u0", "u1"])
    expect(summary.failed.map((r) => r.id)).toEqual(["u2", "u3"])
    expect(summary.stopped).toBe(true)
    expect(socket.released).toBe(1)
  })

  it("writes nothing at all when it is aborted before the first recipient", async () => {
    const socket = new FakeSocket()
    const { summary } = await runShareToDm(
      {
        socket,
        resolveRoom: room,
        ackTimeoutMs: ACK_MS,
        isAborted: () => true,
      },
      { entries: plan(3), body: "b" },
    )
    expect(socket.sent).toEqual([])
    expect(summary.stopped).toBe(true)
    expect(socket.retained).toBe(1)
    expect(socket.released).toBe(1)
  })
})

describe("the socket is released even when a dependency throws", () => {
  it("rethrows and still releases", async () => {
    const socket = new FakeSocket()
    await expect(
      runShareToDm(
        {
          socket,
          resolveRoom: () => Promise.reject(new Error("network down")),
          ackTimeoutMs: ACK_MS,
        },
        { entries: plan(2), body: "b" },
      ),
    ).rejects.toThrow("network down")
    expect(socket.retained).toBe(1)
    expect(socket.released).toBe(1)
    expect(socket.subscriberCount).toBe(0)
  })

  it("does not touch the socket for an empty plan", async () => {
    const socket = new FakeSocket()
    const { summary, rooms } = await run(socket, [])
    expect(socket.retained).toBe(0)
    expect(socket.released).toBe(0)
    expect(rooms).toEqual([])
    expect(summary).toEqual({ status: "none", sent: [], failed: [], stopped: false })
  })
})

describe("a late ack for a finished recipient cannot corrupt a later one", () => {
  it("scores each clientId only from its own ack", async () => {
    const socket = new FakeSocket("open", "silence")
    const entries = plan(2)
    const promise = runShareToDm(
      { socket, resolveRoom: room, ackTimeoutMs: ACK_MS, openTimeoutMs: OPEN_MS },
      { entries, body: "b" },
    )
    socket.emitAck("cid-1", "room-u1")
    const { summary } = await promise
    expect(summary.sent).toEqual([])
    expect(summary.stopped).toBe(true)
  })
})
