import { describe, expect, it } from "vitest"
import { EventPageBlockSchema } from "../entities.js"
import {
  CreateEventTicketTypeRequestSchema,
  UpdateEventTicketTypeRequestSchema,
} from "../host/tickets.js"
import { JoinEventWaitlistRequestSchema } from "../host/waitlist.js"
import { GuestRsvpVerifyResponseSchema } from "../cleanups.js"

const EVENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const MEDIA = "ffffffff-ffff-4fff-8fff-ffffffffffff"

describe("event page block image urls", () => {
  it("accepts an https platform url and a mediaId reference", () => {
    expect(
      EventPageBlockSchema.safeParse({
        id: "b1",
        kind: "hero",
        mediaId: MEDIA,
        imageUrl: "https://media.civfix.org/covers/a.jpg",
      }).success,
    ).toBe(true)
    expect(
      EventPageBlockSchema.safeParse({
        id: "b2",
        kind: "hosts",
        entries: [{ name: "Ada", avatarMediaId: MEDIA }],
      }).success,
    ).toBe(true)
    expect(
      EventPageBlockSchema.safeParse({
        id: "b3",
        kind: "sponsors",
        entries: [{ name: "Acme", logoMediaId: MEDIA }],
      }).success,
    ).toBe(true)
  })

  it("rejects a non-https scheme, an IP-literal host and embedded credentials", () => {
    for (const imageUrl of [
      "http://example.org/px.gif",
      "javascript:alert(1)",
      "https://203.0.113.9/px.gif",
      "https://user:pass@example.org/px.gif",
      "not a url",
    ]) {
      expect(
        EventPageBlockSchema.safeParse({ id: "b1", kind: "hero", imageUrl }).success,
        imageUrl,
      ).toBe(false)
    }
    expect(
      EventPageBlockSchema.safeParse({
        id: "b2",
        kind: "hosts",
        entries: [{ name: "Ada", avatarUrl: "http://tracker.example/a.png" }],
      }).success,
    ).toBe(false)
    expect(
      EventPageBlockSchema.safeParse({
        id: "b3",
        kind: "sponsors",
        entries: [{ name: "Acme", logoUrl: "http://tracker.example/a.png" }],
      }).success,
    ).toBe(false)
  })
})

describe("ticket type sales window", () => {
  const base = { id: EVENT, name: "General", visibility: "public" as const }

  it("rejects a window that closes at or before it opens", () => {
    for (const salesClosesAt of ["2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z"]) {
      expect(
        CreateEventTicketTypeRequestSchema.safeParse({
          ...base,
          salesOpensAt: "2026-02-01T00:00:00.000Z",
          salesClosesAt,
        }).success,
      ).toBe(false)
    }
    expect(
      UpdateEventTicketTypeRequestSchema.safeParse({
        id: EVENT,
        ticketTypeId: MEDIA,
        salesOpensAt: "2026-02-01T00:00:00.000Z",
        salesClosesAt: "2026-01-01T00:00:00.000Z",
      }).success,
    ).toBe(false)
  })

  it("accepts an open-ended window and a well-ordered one", () => {
    expect(CreateEventTicketTypeRequestSchema.safeParse(base).success).toBe(true)
    expect(
      CreateEventTicketTypeRequestSchema.safeParse({
        ...base,
        salesOpensAt: "2026-01-01T00:00:00.000Z",
        salesClosesAt: "2026-02-01T00:00:00.000Z",
      }).success,
    ).toBe(true)
    expect(
      CreateEventTicketTypeRequestSchema.safeParse({
        ...base,
        salesClosesAt: "2026-02-01T00:00:00.000Z",
      }).success,
    ).toBe(true)
  })
})

describe("waitlist join carries the access code", () => {
  it("accepts an optional access code and still accepts none", () => {
    expect(
      JoinEventWaitlistRequestSchema.safeParse({
        id: EVENT,
        ticketTypeId: MEDIA,
        accessCode: "crew-code",
      }).success,
    ).toBe(true)
    expect(
      JoinEventWaitlistRequestSchema.safeParse({ id: EVENT, ticketTypeId: MEDIA }).success,
    ).toBe(true)
  })
})

describe("guest rsvp verify response", () => {
  it("carries the registration outcome when no seat was taken", () => {
    const parsed = GuestRsvpVerifyResponseSchema.parse({
      joined: true,
      going: 4,
      manageToken: "m".repeat(32),
      registration: null,
      registrationOutcome: "full",
      ticketTokens: [],
    })
    expect(parsed.registrationOutcome).toBe("full")
  })

  it("stays valid for a client that sends no outcome at all", () => {
    const parsed = GuestRsvpVerifyResponseSchema.parse({
      joined: true,
      going: 1,
      manageToken: "m".repeat(32),
    })
    expect(parsed.registrationOutcome).toBeUndefined()
  })
})
