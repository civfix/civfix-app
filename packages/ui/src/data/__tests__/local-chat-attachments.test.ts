import { beforeEach, describe, expect, it } from "vitest"
import type { ChatItem, ChatMessageDTO, MediaDTO } from "@civfix/shared"
import {
  clearLocalChatAttachments,
  linkLocalChatAttachments,
  localChatAttachments,
  mergeLocalAttachments,
  rememberLocalChatAttachments,
  restoreLocalChatAttachments,
  withLocalChatAttachments,
} from "../localChatAttachments"

function media(id: string, url: string): MediaDTO {
  return { id, kind: "image", url, thumbUrl: null, status: "validating" } as MediaDTO
}

function msg(partial: Partial<ChatMessageDTO> & { id: string }): ChatMessageDTO {
  return {
    cleanupId: "room-1",
    from: { id: "u1", name: "Ada", followers: 0, following: 0, isFollowing: false },
    body: "",
    kind: "text",
    attachments: [],
    reactions: [],
    mentions: [],
    createdAt: "2026-09-16T12:00:00.000Z",
    ...partial,
  } as ChatMessageDTO
}

function item(message: ChatMessageDTO): ChatItem {
  return { message, pending: false, failed: false, mine: true }
}

beforeEach(() => {
  clearLocalChatAttachments()
})

describe("mergeLocalAttachments", () => {
  it("keeps the local attachments when the server returned none", () => {
    const local = [media("a", "file://a.jpg")]
    expect(mergeLocalAttachments(local, [])).toBe(local)
  })

  it("lets the server win once it returns at least as many", () => {
    const server = [media("a", "https://cdn/a.jpg")]
    expect(mergeLocalAttachments([media("a", "file://a.jpg")], server)).toBe(server)
  })

  it("fills only the gaps when the server returned a partial set", () => {
    const local = [media("a", "file://a.jpg"), media("b", "file://b.jpg")]
    const server = [media("b", "https://cdn/b.jpg")]
    expect(mergeLocalAttachments(local, server).map((m) => m.url)).toEqual([
      "file://a.jpg",
      "https://cdn/b.jpg",
    ])
  })

  it("appends server attachments the optimistic message never had", () => {
    const local = [media("a", "file://a.jpg"), media("b", "file://b.jpg")]
    const server = [media("z", "https://cdn/z.jpg")]
    expect(mergeLocalAttachments(local, server).map((m) => m.id)).toEqual(["a", "b", "z"])
  })
})

describe("withLocalChatAttachments", () => {
  it("returns the message untouched when nothing was remembered", () => {
    const m = msg({ id: "m1" })
    expect(withLocalChatAttachments(m)).toBe(m)
  })

  it("restores the local attachments for an ack that dropped them", () => {
    rememberLocalChatAttachments("c1", [media("a", "file://a.jpg")])
    const restored = withLocalChatAttachments(msg({ id: "m1", clientId: "c1" }))
    expect(restored.attachments?.map((m) => m.url)).toEqual(["file://a.jpg"])
  })

  it("resolves by server id once the client id has been linked", () => {
    rememberLocalChatAttachments("c1", [media("a", "file://a.jpg")])
    linkLocalChatAttachments("c1", "m1")
    const restored = withLocalChatAttachments(msg({ id: "m1" }))
    expect(restored.attachments?.map((m) => m.url)).toEqual(["file://a.jpg"])
  })

  it("stops overriding once the server serves the attachment", () => {
    rememberLocalChatAttachments("c1", [media("a", "file://a.jpg")])
    linkLocalChatAttachments("c1", "m1")
    const ready = media("a", "https://cdn/a.jpg")
    expect(withLocalChatAttachments(msg({ id: "m1", attachments: [ready] })).attachments).toEqual([
      ready,
    ])
  })

  it("ignores an empty optimistic attachment list", () => {
    rememberLocalChatAttachments("c1", [])
    expect(localChatAttachments(msg({ id: "m1", clientId: "c1" }))).toBeNull()
  })
})

describe("restoreLocalChatAttachments", () => {
  it("returns the same array when no item needs restoring", () => {
    const items = [item(msg({ id: "m1" }))]
    expect(restoreLocalChatAttachments(items)).toBe(items)
  })

  it("replaces only the affected item", () => {
    rememberLocalChatAttachments("c1", [media("a", "file://a.jpg")])
    const untouched = item(msg({ id: "m2" }))
    const items = [item(msg({ id: "m1", clientId: "c1" })), untouched]
    const next = restoreLocalChatAttachments(items)
    expect(next).not.toBe(items)
    expect(next[1]).toBe(untouched)
    expect(next[0]?.message.attachments).toHaveLength(1)
  })
})
