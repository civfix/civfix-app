import { describe, it, expect } from "vitest"
import { ChatMessageDTOSchema, ChatMessageKindSchema } from "../src/schemas/entities.js"
import type { PersonDTO } from "../src/schemas/entities.js"

/**
 * Sender-less system messages (report status timeline events pushed into report chat) must be
 * representable in the shared chat DTOs; this only asserts the contract parses.
 */

const AUTHOR: PersonDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Alex Rivera",
  followers: 0,
  following: 0,
  isFollowing: false,
}

describe("ChatMessageKindSchema", () => {
  it("accepts the new system kind", () => {
    expect(ChatMessageKindSchema.parse("system")).toBe("system")
  })
})

describe("ChatMessageDTOSchema system messages", () => {
  it("parses a sender-less report system-event message", () => {
    const parsed = ChatMessageDTOSchema.parse({
      id: "22222222-2222-4222-8222-222222222222",
      cleanupId: "33333333-3333-4333-8333-333333333333",
      roomKind: "report",
      from: null,
      body: null,
      kind: "system",
      createdAt: "2026-07-06T00:00:00.000Z",
      system: {
        status: "acknowledged",
        kind: "status",
      },
    })

    expect(parsed.from).toBeNull()
    expect(parsed.system).toEqual({ status: "acknowledged", kind: "status" })
  })

  it("still parses a normal authored message", () => {
    const parsed = ChatMessageDTOSchema.parse({
      id: "44444444-4444-4444-8444-444444444444",
      cleanupId: "33333333-3333-4333-8333-333333333333",
      roomKind: "report",
      from: AUTHOR,
      body: "hello",
      kind: "text",
      createdAt: "2026-07-06T00:00:00.000Z",
    })

    expect(parsed.from).toEqual(AUTHOR)
    expect(parsed.system).toBeUndefined()
  })
})

describe("ChatMessageDTOSchema @city forward fields (report rooms)", () => {
  it("parses cityMention + forwardedToCity on a report message", () => {
    const parsed = ChatMessageDTOSchema.parse({
      id: "55555555-5555-4555-8555-555555555555",
      cleanupId: "33333333-3333-4333-8333-333333333333",
      roomKind: "report",
      from: AUTHOR,
      body: "@sf please fix",
      kind: "text",
      createdAt: "2026-07-06T00:00:00.000Z",
      cityMention: { handle: "sf", geoid: "0667000", name: "San Francisco", forwarded: true },
      forwardedToCity: true,
    })

    expect(parsed.forwardedToCity).toBe(true)
    expect(parsed.cityMention?.handle).toBe("sf")
  })

  it("omits the city fields on a cleanup message", () => {
    const parsed = ChatMessageDTOSchema.parse({
      id: "66666666-6666-4666-8666-666666666666",
      cleanupId: "33333333-3333-4333-8333-333333333333",
      from: AUTHOR,
      body: "hi",
      kind: "text",
      createdAt: "2026-07-06T00:00:00.000Z",
    })

    expect(parsed.cityMention).toBeUndefined()
    expect(parsed.forwardedToCity).toBeUndefined()
  })
})
