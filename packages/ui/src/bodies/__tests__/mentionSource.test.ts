import { describe, expect, it } from "vitest"
import {
  resolveMentionSource,
  type MentionPersonInput,
  type MentionSourceInput,
} from "../mentionSource"

const avatar: MentionPersonInput["avatar"] = ["#111111", "#222222"]

function person(overrides: Partial<MentionPersonInput> = {}): MentionPersonInput {
  return {
    id: "u1",
    name: "Alex Doe",
    handle: "alex",
    avatar,
    avatarUrl: null,
    ...overrides,
  }
}

function input(overrides: Partial<MentionSourceInput> = {}): MentionSourceInput {
  return { roomKind: "cleanup", viewerId: "viewer", ...overrides }
}

describe("resolveMentionSource", () => {
  describe("report rooms (global source)", () => {
    it("is UNSCOPED: candidates is null (global mention search), not an empty scoped set", () => {
      const src = resolveMentionSource(input({ roomKind: "report" }))
      expect(src.candidates).toBeNull()
    })

    it("offers the routable jurisdiction as an extra candidate alongside the global source", () => {
      const src = resolveMentionSource(
        input({
          roomKind: "report",
          report: { cityHandle: "oakland", cityName: "City of Oakland", canForwardToCity: true },
        }),
      )
      expect(src.candidates).toBeNull()
      expect(src.extraCandidates).toEqual([
        { kind: "jurisdiction", id: "oakland", handle: "oakland", displayName: "City of Oakland" },
      ])
    })

    it("strips a leading @ from the city handle", () => {
      const src = resolveMentionSource(
        input({ roomKind: "report", report: { cityHandle: "@oakland", cityName: "Oakland" } }),
      )
      expect(src.extraCandidates[0]).toMatchObject({ id: "oakland", handle: "oakland" })
    })

    it("omitted canForwardToCity defaults to reachable (candidate present)", () => {
      const src = resolveMentionSource(
        input({ roomKind: "report", report: { cityHandle: "oakland", cityName: "Oakland" } }),
      )
      expect(src.extraCandidates).toHaveLength(1)
    })

    it("an unreachable city (canForwardToCity false) yields no jurisdiction candidate", () => {
      const src = resolveMentionSource(
        input({
          roomKind: "report",
          report: { cityHandle: "oakland", cityName: "Oakland", canForwardToCity: false },
        }),
      )
      expect(src.extraCandidates).toEqual([])
      expect(src.candidates).toBeNull()
    })

    it("a handleless / unloaded report yields no jurisdiction candidate but keeps the global source", () => {
      for (const report of [undefined, null, {}, { cityHandle: null }, { cityHandle: "" }]) {
        const src = resolveMentionSource(input({ roomKind: "report", report }))
        expect(src.candidates).toBeNull()
        expect(src.extraCandidates).toEqual([])
      }
    })

    it("a missing city name falls back to the bare handle (no hardcoded copy)", () => {
      const src = resolveMentionSource(
        input({ roomKind: "report", report: { cityHandle: "@oakland" } }),
      )
      expect(src.extraCandidates[0]?.displayName).toBe("oakland")
    })
  })

  describe("dm rooms (unchanged: scoped to the peer)", () => {
    it("scopes to the single peer", () => {
      const src = resolveMentionSource(input({ roomKind: "dm", peer: person() }))
      expect(src.candidates).toEqual([
        { id: "u1", handle: "alex", displayName: "Alex Doe", avatar, avatarUrl: null },
      ])
      expect(src.extraCandidates).toEqual([])
    })

    it("a handleless or unknown peer yields an EMPTY scoped set (never the global search)", () => {
      expect(
        resolveMentionSource(input({ roomKind: "dm", peer: person({ handle: null }) })).candidates,
      ).toEqual([])
      expect(resolveMentionSource(input({ roomKind: "dm" })).candidates).toEqual([])
    })
  })

  describe("group rooms (scoped to the member roster, global until loaded)", () => {
    it("scopes to the loaded roster first page, dropping the viewer and the handleless", () => {
      const src = resolveMentionSource(
        input({
          roomKind: "group",
          viewerId: "me",
          groupMembers: [
            person({ id: "me", handle: "self" }),
            person({ id: "u2", handle: "bea", name: "Bea", avatarUrl: "https://x/b.jpg" }),
            person({ id: "u3", handle: null, name: "No Handle" }),
          ],
        }),
      )
      expect(src.candidates).toEqual([
        { id: "u2", handle: "bea", displayName: "Bea", avatar, avatarUrl: "https://x/b.jpg" },
      ])
      expect(src.extraCandidates).toEqual([])
    })

    it("an UNLOADED roster falls back to the global search (candidates null), unlike cleanup", () => {
      for (const groupMembers of [undefined, null]) {
        const src = resolveMentionSource(input({ roomKind: "group", groupMembers }))
        expect(src.candidates).toBeNull()
        expect(src.extraCandidates).toEqual([])
      }
    })

    it("a loaded SOLO group (viewer is the only member) yields an EMPTY scoped set, not global", () => {
      const src = resolveMentionSource(
        input({
          roomKind: "group",
          viewerId: "me",
          groupMembers: [person({ id: "me", handle: "self" })],
        }),
      )
      expect(src.candidates).toEqual([])
    })

    it("never offers a jurisdiction extra candidate, even when a report slice is passed", () => {
      const src = resolveMentionSource(
        input({
          roomKind: "group",
          groupMembers: [person()],
          report: { cityHandle: "oakland", cityName: "Oakland" },
        }),
      )
      expect(src.extraCandidates).toEqual([])
    })
  })

  describe("cleanup rooms (unchanged: scoped to the roster)", () => {
    it("maps the roster, dropping the viewer and the handleless", () => {
      const src = resolveMentionSource(
        input({
          roomKind: "cleanup",
          viewerId: "me",
          attendees: [
            person({ id: "me", handle: "self" }),
            person({ id: "u2", handle: "bea", name: "Bea", avatarUrl: "https://x/b.jpg" }),
            person({ id: "u3", handle: null, name: "No Handle" }),
          ],
        }),
      )
      expect(src.candidates).toEqual([
        { id: "u2", handle: "bea", displayName: "Bea", avatar, avatarUrl: "https://x/b.jpg" },
      ])
      expect(src.extraCandidates).toEqual([])
    })

    it("an unloaded roster yields an EMPTY scoped set (never the global search)", () => {
      const src = resolveMentionSource(input({ roomKind: "cleanup", attendees: undefined }))
      expect(src.candidates).toEqual([])
    })
  })
})
