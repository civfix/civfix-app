import {
  WsClientMessageSchema,
  WsServerMessageSchema,
  nextBackoffMs,
  type RoomKind,
  type WsClientMessage,
  type WsServerMessage,
} from "@civfix/shared"

import type { ChatConnState, ChatSendOutcome, ChatSocketLike } from "../data/types"
import type { ChatSocketCoreOptions, WsConnection, WsTransport } from "./types"

const WS_OPEN = 1

function roomKeyOf(roomId: string, roomKind: RoomKind): string {
  return `${roomKind}:${roomId}`
}

function roomFrame(type: "join" | "leave", roomId: string, roomKind: RoomKind): WsClientMessage {
  return { type, cleanupId: roomId, ...(roomKind !== "cleanup" ? { roomKind } : {}) }
}

function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof (value as { then?: unknown } | null)?.then === "function"
}

export class ChatSocketCore implements ChatSocketLike {
  private readonly transport: WsTransport
  private readonly baseBackoffMs: number
  private readonly maxBackoffMs: number
  private readonly retryWhenUnavailable: boolean
  private readonly queueWhileClosed: boolean
  private readonly teardownPolicy: "intent" | "eager"
  private readonly statusWhileBackingOff: ChatConnState
  private readonly onConnectIntent: (() => void) | undefined
  private readonly onInvalidFrame: ChatSocketCoreOptions["onInvalidFrame"]

  private socket: WebSocket | null = null
  private status: ChatConnState
  private attempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private sendQueue: WsClientMessage[] = []

  private shouldConnect = false
  private refCount = 0
  private opening = false
  private connectEpoch = 0
  private suspended = false
  private openedAuthKey: string | null = null

  private readonly rooms = new Map<string, { roomId: string; roomKind: RoomKind }>()
  private readonly rejectedRooms = new Set<string>()

  private readonly statusListeners = new Set<(status: ChatConnState) => void>()
  private readonly messageListeners = new Set<(frame: WsServerMessage) => void>()

  constructor(options: ChatSocketCoreOptions) {
    this.transport = options.transport
    this.baseBackoffMs = options.baseBackoffMs ?? 1000
    this.maxBackoffMs = options.maxBackoffMs ?? 15000
    this.retryWhenUnavailable = options.retryWhenUnavailable ?? false
    this.queueWhileClosed = options.queueWhileClosed ?? false
    this.teardownPolicy = options.teardownPolicy ?? "intent"
    this.status = options.initialStatus ?? "closed"
    this.statusWhileBackingOff = options.statusWhileBackingOff ?? "connecting"
    this.onConnectIntent = options.onConnectIntent
    this.onInvalidFrame = options.onInvalidFrame
  }

  getStatus(): ChatConnState {
    return this.status
  }

  onStatus(handler: (status: ChatConnState) => void): () => void {
    this.statusListeners.add(handler)
    handler(this.status)
    return () => {
      this.statusListeners.delete(handler)
    }
  }

  subscribe(handler: (frame: WsServerMessage) => void): () => void {
    this.messageListeners.add(handler)
    return () => {
      this.messageListeners.delete(handler)
    }
  }

  connect(): void {
    this.shouldConnect = true
    this.suspended = false
    this.ensureOpen()
  }

  disconnect(): void {
    this.shouldConnect = false
    this.suspended = false
    if (this.teardownPolicy === "eager") {
      this.refCount = 0
    } else if (this.refCount > 0) {
      return
    }
    this.teardown()
  }

  retain(): void {
    this.refCount += 1
    this.ensureOpen()
  }

  release(): void {
    this.refCount = Math.max(0, this.refCount - 1)
    if (this.refCount > 0) return
    if (this.teardownPolicy === "eager") {
      this.disconnect()
      return
    }
    if (!this.shouldConnect) this.teardown()
  }

  suspend(): void {
    this.suspended = true
    this.clearReconnect()
    this.closeSocket()
    this.setStatus("closed")
  }

  resume(): void {
    if (!this.suspended) return
    this.suspended = false
    this.attempt = 0
    this.clearReconnect()
    this.ensureOpen()
  }

  join(roomId: string, roomKind: RoomKind): void {
    const key = roomKeyOf(roomId, roomKind)
    this.rooms.set(key, { roomId, roomKind })
    this.rejectedRooms.delete(key)
    if (this.isOpen()) {
      this.writeFrame(roomFrame("join", roomId, roomKind))
    } else {
      this.ensureOpen()
    }
  }

  leave(roomId: string, roomKind: RoomKind): void {
    const key = roomKeyOf(roomId, roomKind)
    this.rooms.delete(key)
    this.rejectedRooms.delete(key)
    if (this.isOpen()) this.writeFrame(roomFrame("leave", roomId, roomKind))
  }

  markRoomRejected(roomId: string, roomKind: RoomKind): void {
    this.rejectedRooms.add(roomKeyOf(roomId, roomKind))
  }

  isRoomRejected(roomId: string, roomKind: RoomKind): boolean {
    return this.rejectedRooms.has(roomKeyOf(roomId, roomKind))
  }

  send(message: WsClientMessage): ChatSendOutcome {
    const parsed = WsClientMessageSchema.safeParse(message)
    if (!parsed.success) {
      this.onInvalidFrame?.("outbound", parsed.error.issues)
      return "dropped"
    }
    const frame = parsed.data
    if (this.isOpen()) {
      try {
        this.socket!.send(JSON.stringify(frame))
        return "sent"
      } catch {
        if (!this.queueWhileClosed) return "dropped"
        this.sendQueue.push(frame)
        return "queued"
      }
    }
    if (!this.queueWhileClosed) return "dropped"
    this.sendQueue.push(frame)
    this.ensureOpen()
    return "queued"
  }

  private isOpen(): boolean {
    return this.socket !== null && this.socket.readyState === WS_OPEN
  }

  private writeFrame(frame: WsClientMessage): void {
    const parsed = WsClientMessageSchema.safeParse(frame)
    if (!parsed.success || !this.isOpen()) return
    try {
      this.socket!.send(JSON.stringify(parsed.data))
    } catch {
      return
    }
  }

  private canOpen(): boolean {
    return !this.suspended && (this.shouldConnect || this.refCount > 0)
  }

  private ensureOpen(): void {
    this.onConnectIntent?.()
    if (!this.canOpen()) return
    this.clearReconnect()
    if (this.opening) return
    if (this.socket) {
      this.guardIdentity()
      return
    }

    this.opening = true
    const epoch = this.connectEpoch
    let result: WsConnection | null | Promise<WsConnection | null>
    try {
      result = this.transport.open()
    } catch {
      this.opening = false
      this.scheduleReconnect()
      return
    }
    if (isPromise(result)) {
      this.setStatus("connecting")
      result.then(
        (connection) => this.adoptConnection(connection, epoch),
        () => {
          if (epoch !== this.connectEpoch) return
          this.opening = false
          this.scheduleReconnect()
        },
      )
      return
    }
    this.adoptConnection(result, epoch)
  }

  private adoptConnection(connection: WsConnection | null, epoch: number): void {
    if (epoch !== this.connectEpoch) {
      if (connection) closeQuietly(connection.socket)
      return
    }
    this.opening = false
    if (!this.canOpen()) {
      if (connection) closeQuietly(connection.socket)
      this.setStatus("closed")
      return
    }
    if (!connection) {
      this.setStatus("closed")
      if (this.retryWhenUnavailable) this.scheduleReconnect()
      return
    }

    if (this.socket && this.socket !== connection.socket) closeQuietly(this.socket)

    this.setStatus("connecting")
    const socket = connection.socket
    this.socket = socket
    this.openedAuthKey = connection.authKey ?? null

    socket.onopen = () => {
      if (this.socket !== socket) return
      this.attempt = 0
      this.setStatus("open")
      for (const [key, room] of this.rooms) {
        if (this.rejectedRooms.has(key)) continue
        this.writeFrame(roomFrame("join", room.roomId, room.roomKind))
      }
      this.flushQueue()
    }

    socket.onmessage = (event: { data: unknown }) => {
      this.handleRawFrame(event.data)
    }

    socket.onerror = () => {
    }

    socket.onclose = () => {
      if (this.socket === socket) {
        this.socket = null
        this.openedAuthKey = null
      }
      if (this.canOpen()) {
        this.scheduleReconnect()
      } else {
        this.setStatus("closed")
      }
    }
  }

  private guardIdentity(): void {
    if (!this.transport.authKey) return
    let current: string | null | Promise<string | null>
    try {
      current = this.transport.authKey()
    } catch {
      return
    }
    const compare = (key: string | null): void => {
      if (!this.canOpen() || !this.socket) return
      if (key === this.openedAuthKey) return
      this.closeSocket()
      this.ensureOpen()
    }
    if (isPromise(current)) {
      current.then(compare, () => {
      })
      return
    }
    compare(current)
  }

  private closeSocket(): void {
    this.connectEpoch += 1
    this.opening = false
    const socket = this.socket
    this.socket = null
    this.openedAuthKey = null
    if (socket) closeQuietly(socket)
  }

  private teardown(): void {
    this.clearReconnect()
    this.sendQueue = []
    this.rooms.clear()
    this.rejectedRooms.clear()
    this.closeSocket()
    this.setStatus("closed")
  }

  private handleRawFrame(raw: unknown): void {
    let json: unknown
    try {
      json = typeof raw === "string" ? JSON.parse(raw) : raw
    } catch {
      this.onInvalidFrame?.("inbound", "non-JSON frame")
      return
    }
    const parsed = WsServerMessageSchema.safeParse(json)
    if (!parsed.success) {
      this.onInvalidFrame?.("inbound", parsed.error.issues)
      return
    }
    for (const listener of this.messageListeners) {
      try {
        listener(parsed.data)
      } catch {
        continue
      }
    }
  }

  private flushQueue(): void {
    if (!this.isOpen() || this.sendQueue.length === 0) return
    const queued = this.sendQueue
    this.sendQueue = []
    for (let i = 0; i < queued.length; i += 1) {
      try {
        this.socket!.send(JSON.stringify(queued[i]!))
      } catch {
        this.sendQueue = [...queued.slice(i), ...this.sendQueue]
        return
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.canOpen()) return
    const delay = nextBackoffMs(this.attempt, {
      baseMs: this.baseBackoffMs,
      capMs: this.maxBackoffMs,
    })
    this.attempt += 1
    this.setStatus(this.statusWhileBackingOff)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.ensureOpen()
    }, delay)
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private setStatus(next: ChatConnState): void {
    if (this.status === next) return
    this.status = next
    for (const listener of this.statusListeners) {
      try {
        listener(next)
      } catch {
        continue
      }
    }
  }
}

function closeQuietly(socket: WebSocket): void {
  socket.onopen = null
  socket.onmessage = null
  socket.onerror = null
  socket.onclose = null
  try {
    socket.close()
  } catch {
    return
  }
}
