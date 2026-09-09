import { describe, it, expect } from "vitest"
import { WsServerMessageSchema, WsClientMessageSchema, UserSignalSchema } from "../src/types/ws.js"

/**
 * The WS frame contract is the wire boundary shared by the server gateway and both clients. These tests
 * lock the realtime additions (typing + presence_snapshot server frames) AND assert the pre-existing
 * frames still parse, so the discriminated-union extension stays backward compatible (an older client
 * built against the prior contract drops the new frames rather than crashing).
 */

const ROOM = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const USER = "11111111-1111-1111-1111-111111111111"

describe("WsServerMessageSchema realtime additions", () => {
  it("accepts a typing frame", () => {
    const parsed = WsServerMessageSchema.safeParse({ type: "typing", cleanupId: ROOM, userId: USER })
    expect(parsed.success).toBe(true)
  })

  it("accepts a presence_snapshot frame (deduped online ids)", () => {
    const parsed = WsServerMessageSchema.safeParse({
      type: "presence_snapshot",
      cleanupId: ROOM,
      userIds: [USER],
    })
    expect(parsed.success).toBe(true)
  })

  it("accepts an empty presence_snapshot (nobody online)", () => {
    const parsed = WsServerMessageSchema.safeParse({
      type: "presence_snapshot",
      cleanupId: ROOM,
      userIds: [],
    })
    expect(parsed.success).toBe(true)
  })

  it("rejects a typing frame missing userId", () => {
    const parsed = WsServerMessageSchema.safeParse({ type: "typing", cleanupId: ROOM })
    expect(parsed.success).toBe(false)
  })

  it("still accepts the pre-existing presence delta", () => {
    const parsed = WsServerMessageSchema.safeParse({
      type: "presence",
      cleanupId: ROOM,
      userId: USER,
      state: "join",
    })
    expect(parsed.success).toBe(true)
  })

  it("accepts roomKind:'dm' on presence / presence_snapshot / typing server frames", () => {
    expect(
      WsServerMessageSchema.safeParse({
        type: "presence",
        cleanupId: ROOM,
        roomKind: "dm",
        userId: USER,
        state: "leave",
      }).success,
    ).toBe(true)
    expect(
      WsServerMessageSchema.safeParse({
        type: "presence_snapshot",
        cleanupId: ROOM,
        roomKind: "dm",
        userIds: [USER],
      }).success,
    ).toBe(true)
    expect(
      WsServerMessageSchema.safeParse({ type: "typing", cleanupId: ROOM, roomKind: "dm", userId: USER })
        .success,
    ).toBe(true)
  })

  it("accepts roomKind 'group' (P4 room kind)", () => {
    expect(
      WsServerMessageSchema.safeParse({ type: "typing", cleanupId: ROOM, roomKind: "group", userId: USER })
        .success,
    ).toBe(true)
  })

  it("rejects an unknown roomKind", () => {
    expect(
      WsServerMessageSchema.safeParse({ type: "typing", cleanupId: ROOM, roomKind: "bogus", userId: USER })
        .success,
    ).toBe(false)
  })

  it("accepts a per-user signal frame (bare topic)", () => {
    const parsed = WsServerMessageSchema.safeParse({ type: "signal", topic: "notifications" })
    expect(parsed.success).toBe(true)
  })

  it("accepts a signal frame with an optional scoping id", () => {
    const parsed = WsServerMessageSchema.safeParse({ type: "signal", topic: "threads", id: ROOM })
    expect(parsed.success).toBe(true)
  })

  it("rejects a signal frame with an unknown topic", () => {
    const parsed = WsServerMessageSchema.safeParse({ type: "signal", topic: "mentions" })
    expect(parsed.success).toBe(false)
  })

  it("rejects a signal frame missing topic", () => {
    const parsed = WsServerMessageSchema.safeParse({ type: "signal" })
    expect(parsed.success).toBe(false)
  })

  it("still accepts every pre-signal frame (backward-compat lock)", () => {
    // The signal variant was added to the SAME union; the prior frames must keep parsing unchanged.
    expect(WsServerMessageSchema.safeParse({ type: "presence", cleanupId: ROOM, userId: USER, state: "join" }).success).toBe(true)
    expect(WsServerMessageSchema.safeParse({ type: "typing", cleanupId: ROOM, userId: USER }).success).toBe(true)
    expect(WsServerMessageSchema.safeParse({ type: "ack", clientId: "c1", message: { id: ROOM, cleanupId: ROOM, from: { id: USER, name: "U", handle: null, bio: null, avatar: null, followers: 0, following: 0, isFollowing: false }, body: "hi", kind: "text", attachments: null, createdAt: "2026-01-01T00:00:00.000Z", editedAt: null } }).success).toBe(true)
    expect(WsServerMessageSchema.safeParse({ type: "error", code: "BAD_FRAME", message: "no" }).success).toBe(true)
  })

  it("UserSignalSchema rejects an unknown extra key (.strict)", () => {
    expect(UserSignalSchema.safeParse({ topic: "reports", extra: 1 }).success).toBe(false)
    expect(UserSignalSchema.safeParse({ topic: "reports" }).success).toBe(true)
  })

  it("accepts a room-scoped error frame AND a bare (connection-level) error frame", () => {
    // Room-scoped: the gateway stamps the room so a client filters it to one room.
    expect(
      WsServerMessageSchema.safeParse({
        type: "error",
        code: "FORBIDDEN",
        message: "no",
        cleanupId: ROOM,
        roomKind: "dm",
      }).success,
    ).toBe(true)
    // Bare: a connection-level error (no room) — still valid (older shape).
    expect(
      WsServerMessageSchema.safeParse({ type: "error", code: "BAD_FRAME", message: "no" }).success,
    ).toBe(true)
  })
})

describe("WsClientMessageSchema DM roomKind additions stay backward compatible", () => {
  it("accepts a cleanup typing/join frame with no roomKind (legacy clients)", () => {
    expect(WsClientMessageSchema.safeParse({ type: "typing", cleanupId: ROOM }).success).toBe(true)
    expect(WsClientMessageSchema.safeParse({ type: "join", cleanupId: ROOM }).success).toBe(true)
  })

  it("accepts a DM join/send/typing frame carrying roomKind:'dm'", () => {
    expect(WsClientMessageSchema.safeParse({ type: "join", cleanupId: ROOM, roomKind: "dm" }).success).toBe(
      true,
    )
    expect(
      WsClientMessageSchema.safeParse({
        type: "send",
        cleanupId: ROOM,
        roomKind: "dm",
        clientId: "c1",
        body: "hi",
      }).success,
    ).toBe(true)
    expect(
      WsClientMessageSchema.safeParse({ type: "typing", cleanupId: ROOM, roomKind: "dm" }).success,
    ).toBe(true)
  })

  it("accepts a bare ack (legacy) AND a room-scoped ack (cleanupId + roomKind)", () => {
    expect(WsClientMessageSchema.safeParse({ type: "ack", upToId: ROOM }).success).toBe(true)
    expect(
      WsClientMessageSchema.safeParse({ type: "ack", upToId: ROOM, cleanupId: ROOM, roomKind: "dm" })
        .success,
    ).toBe(true)
  })
})
