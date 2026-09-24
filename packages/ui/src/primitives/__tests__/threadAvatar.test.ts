import { describe, expect, it } from "vitest"
import { avatarColor, monogram, type MessageThreadDTO, type PersonDTO } from "@civfix/shared"
import { resolveThreadAvatar } from "../threadAvatarResolve"

function person(over: Partial<PersonDTO> = {}): PersonDTO {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Alex Rivera",
    handle: "alex",
    avatar: ["#aaaaaa", "#bbbbbb"],
    avatarUrl: null,
    followers: 0,
    following: 0,
    isFollowing: false,
    ...over,
  }
}

function thread(over: Partial<MessageThreadDTO> = {}): MessageThreadDTO {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    kind: "dm",
    title: "@alex",
    lastFromMe: false,
    unread: 0,
    members: 0,
    muted: false,
    ...over,
  }
}

describe("resolveThreadAvatar", () => {
  it("shows the peer's real backend photo for a DM when one is set", () => {
    const photo = "https://cdn.example.com/avatars/alex.jpg"
    const r = resolveThreadAvatar(thread({ peer: person({ avatarUrl: photo }) }))
    expect(r.isGroup).toBe(false)
    expect(r.photoUrl).toBe(photo)
  })

  it("falls back to the peer's solid color + single-letter monogram when there is no photo", () => {
    const r = resolveThreadAvatar(thread({ peer: person({ name: "Alex Rivera", avatarUrl: null }) }))
    expect(r.photoUrl).toBeNull()
    // The seed is the peer id and the color is the peer's server avatar pair's first stop (exact match
    // to how the SAME person renders in connections/feed/profile).
    expect(r.seed).toBe("11111111-1111-1111-1111-111111111111")
    expect(r.gradient).toEqual(["#aaaaaa", "#bbbbbb"])
    // Avatar draws monogram(name): a SINGLE uppercase letter (the first letter of the name), never two-letter initials.
    expect(r.name).toBe("Alex Rivera")
    expect(monogram(r.name)).toBe("A")
  })

  it("uses avatarColor(peer id) when the peer has no server avatar pair - matching the rest of the app", () => {
    const r = resolveThreadAvatar(thread({ peer: person({ avatar: null as never, avatarUrl: null }) }))
    expect(r.color).toBe(avatarColor("11111111-1111-1111-1111-111111111111"))
  })

  it("derives the seed/letter from the thread itself when no peer is attached (header pseudo-thread)", () => {
    const r = resolveThreadAvatar(thread({ peer: null, refId: "room-9", title: "@sam" }))
    expect(r.isGroup).toBe(false)
    expect(r.photoUrl).toBeNull()
    expect(r.seed).toBe("room-9")
    expect(r.name).toBe("@sam")
    expect(monogram(r.name)).toBe("S")
  })

  it("renders a glyph on a solid room-seeded color for a group/cleanup/report (no gradient, no photo)", () => {
    for (const kind of ["group", "cleanup", "report"] as const) {
      const r = resolveThreadAvatar(
        thread({ kind, refId: "room-7", peer: person({ avatarUrl: "https://x/y.jpg" }) }),
      )
      expect(r.isGroup).toBe(true)
      // A group never shows a peer photo even if one is (erroneously) attached.
      expect(r.photoUrl).toBeNull()
      expect(r.color).toBe(avatarColor("room-7"))
    }
  })
})
