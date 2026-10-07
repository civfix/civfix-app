import { describe, expect, it } from "vitest"
import { avatarColor } from "@civfix/shared"
import { resolveThreadAvatar, type ThreadAvatarInput } from "../threadAvatarResolve"

const PEER = { id: "peer-1", name: "maria lopez", avatarUrl: null, avatar: null as never }

function input(over: Partial<ThreadAvatarInput> = {}): ThreadAvatarInput {
  return { id: "thread-1", kind: "dm", title: "Group title", ...over }
}

describe("resolveThreadAvatar seed fallback", () => {
  it("seeds a DM from the peer id ahead of the room ref and the thread id", () => {
    expect(resolveThreadAvatar(input({ refId: "room-1", peer: PEER })).seed).toBe("peer-1")
  })

  it("seeds from the thread id when there is neither a peer nor a ref", () => {
    const r = resolveThreadAvatar(input())
    expect(r.seed).toBe("thread-1")
    expect(r.color).toBe(avatarColor("thread-1"))
  })

  it("seeds a group from its ref even when a peer is attached", () => {
    const r = resolveThreadAvatar(input({ kind: "group", refId: "room-1", peer: PEER }))
    expect(r.seed).toBe("room-1")
    expect(r.gradient).toBeNull()
  })
})

describe("resolveThreadAvatar name", () => {
  it("names a DM after the peer", () => {
    expect(resolveThreadAvatar(input({ peer: PEER })).name).toBe("maria lopez")
  })

  it("names a group after the thread title, ignoring an attached peer", () => {
    expect(resolveThreadAvatar(input({ kind: "cleanup", title: "beach crew", peer: PEER })).name).toBe("beach crew")
  })
})

describe("resolveThreadAvatar colour", () => {
  it("uses the first stop of the peer's server pair as the fill", () => {
    const r = resolveThreadAvatar(input({ peer: { ...PEER, avatar: ["#123456", "#abcdef"] } }))
    expect(r.color).toBe("#123456")
    expect(r.gradient).toEqual(["#123456", "#abcdef"])
  })

  it("treats a missing peer on a DM like no peer", () => {
    const r = resolveThreadAvatar(input({ peer: undefined, refId: "room-2" }))
    expect(r).toMatchObject({ isGroup: false, photoUrl: null, seed: "room-2", gradient: null })
  })

  it("treats only group, cleanup and report as groups", () => {
    expect(resolveThreadAvatar(input({ kind: "dm" })).isGroup).toBe(false)
    for (const kind of ["group", "cleanup", "report"] as const) {
      expect(resolveThreadAvatar(input({ kind })).isGroup).toBe(true)
    }
  })
})
