import { describe, it, expect, vi } from "vitest"
import {
  CleanupGuestDTOSchema,
  GetCleanupGuestsRequestSchema,
  GetCleanupGuestsResponseSchema,
  GuestRsvpRequestResponseSchema,
  GuestRsvpVerifyResponseSchema,
  GuestPhoneSchema,
  GuestRsvpCancelRequestSchema,
  GuestRsvpRequestRequestSchema,
  GuestRsvpVerifyRequestSchema,
  GUEST_MANAGE_TOKEN_MAX_LENGTH,
  GUEST_MANAGE_TOKEN_MIN_LENGTH,
  MAX_GUEST_NAME,
} from "../src/schemas/cleanups.js"
import { CleanupDTOSchema } from "../src/schemas/entities.js"
import {
  EmailOtpVerifyRequestSchema,
  OtpCodeSchema,
  SessionCheckResponseSchema,
  SessionResponseSchema,
} from "../src/schemas/auth.js"
import {
  ProfileEventsRequestSchema,
  ProfileEventsResponseSchema,
  UserProfileDTOSchema,
} from "../src/schemas/social.js"
import { endpoints } from "../src/client/endpoints.js"
import { createApiClient } from "../src/client/client.js"
import { FakeSmsSender } from "../src/fakes/sms-sender.fake.js"

const UUID = "00000000-0000-0000-0000-000000000001"
const UUID2 = "00000000-0000-0000-0000-000000000002"
const PHONE = "+12125550123"

const person = {
  id: UUID2,
  name: "Ada",
  avatar: null,
  followers: 0,
  following: 0,
  isFollowing: false,
}

const requestBase = {
  id: UUID,
  name: "Ada Lovelace",
  turnstileToken: "tk",
}

describe("GuestRsvpRequestRequestSchema channel <-> contact", () => {
  it("accepts channel email with an email and no phone", () => {
    const parsed = GuestRsvpRequestRequestSchema.parse({
      ...requestBase,
      channel: "email",
      email: "Guest@Example.COM",
    })
    expect(parsed.email).toBe("guest@example.com")
    expect(parsed.phone).toBeUndefined()
  })

  it("accepts channel sms with a phone and no email", () => {
    const parsed = GuestRsvpRequestRequestSchema.parse({
      ...requestBase,
      channel: "sms",
      phone: PHONE,
    })
    expect(parsed.phone).toBe(PHONE)
  })

  it("rejects channel email carrying a phone", () => {
    const parsed = GuestRsvpRequestRequestSchema.safeParse({
      ...requestBase,
      channel: "email",
      email: "guest@example.com",
      phone: PHONE,
    })
    expect(parsed.success).toBe(false)
    expect(!parsed.success && parsed.error.issues[0]?.path).toEqual(["phone"])
  })

  it("rejects channel sms carrying an email", () => {
    const parsed = GuestRsvpRequestRequestSchema.safeParse({
      ...requestBase,
      channel: "sms",
      phone: PHONE,
      email: "guest@example.com",
    })
    expect(parsed.success).toBe(false)
    expect(!parsed.success && parsed.error.issues[0]?.path).toEqual(["email"])
  })

  it("rejects a channel with no matching contact at all", () => {
    expect(
      GuestRsvpRequestRequestSchema.safeParse({ ...requestBase, channel: "email" }).success,
    ).toBe(false)
    expect(
      GuestRsvpRequestRequestSchema.safeParse({ ...requestBase, channel: "sms" }).success,
    ).toBe(false)
  })

  it("bounds the guest name and rejects unknown keys", () => {
    expect(
      GuestRsvpRequestRequestSchema.safeParse({
        ...requestBase,
        name: "a".repeat(MAX_GUEST_NAME + 1),
        channel: "sms",
        phone: PHONE,
      }).success,
    ).toBe(false)
    expect(
      GuestRsvpRequestRequestSchema.safeParse({
        ...requestBase,
        channel: "sms",
        phone: PHONE,
        nickname: "x",
      }).success,
    ).toBe(false)
  })
})

describe("the honeypot is accepted at the boundary and flagged server-side", () => {
  const body = { ...requestBase, channel: "sms", phone: PHONE } as const

  it("accepts an absent, empty, or filled website", () => {
    expect(GuestRsvpRequestRequestSchema.safeParse(body).success).toBe(true)
    expect(GuestRsvpRequestRequestSchema.safeParse({ ...body, website: "" }).success).toBe(true)
    const filled = GuestRsvpRequestRequestSchema.safeParse({
      ...body,
      website: "http://spam.example",
    })
    expect(filled.success).toBe(true)
    expect(filled.success && filled.data.website).toBe("http://spam.example")
  })

  it("matches the AnonReportRequest honeypot idiom rather than 422ing the bot", () => {
    const shape = GuestRsvpRequestRequestSchema.innerType().shape
    expect(shape.website.isOptional()).toBe(true)
    expect(shape.website._def.typeName).toBe("ZodOptional")
  })
})

describe("GuestPhoneSchema is US-only E.164", () => {
  it("accepts a +1 number with a valid area code", () => {
    expect(GuestPhoneSchema.safeParse(PHONE).success).toBe(true)
    expect(GuestPhoneSchema.safeParse("+19995550123").success).toBe(true)
  })

  it("rejects a non-+1 country code", () => {
    expect(GuestPhoneSchema.safeParse("+447911123456").success).toBe(false)
    expect(GuestPhoneSchema.safeParse("+521235550123").success).toBe(false)
  })

  it("rejects a +1 number whose area code starts with 0 or 1", () => {
    expect(GuestPhoneSchema.safeParse("+10125550123").success).toBe(false)
    expect(GuestPhoneSchema.safeParse("+11125550123").success).toBe(false)
  })

  it("rejects unformatted, short, and long numbers", () => {
    expect(GuestPhoneSchema.safeParse("2125550123").success).toBe(false)
    expect(GuestPhoneSchema.safeParse("+1212555012").success).toBe(false)
    expect(GuestPhoneSchema.safeParse("+121255501234").success).toBe(false)
    expect(GuestPhoneSchema.safeParse("+1 (212) 555-0123").success).toBe(false)
  })
})

describe("GuestRsvpVerifyRequestSchema code union", () => {
  const verifyBase = { id: UUID, channel: "sms", phone: PHONE } as const

  it("accepts a 6-digit code", () => {
    expect(GuestRsvpVerifyRequestSchema.safeParse({ ...verifyBase, code: "123456" }).success).toBe(
      true,
    )
  })

  it("accepts a 20-character reviewer code and a 128-character one", () => {
    expect(
      GuestRsvpVerifyRequestSchema.safeParse({ ...verifyBase, code: "a".repeat(20) }).success,
    ).toBe(true)
    expect(
      GuestRsvpVerifyRequestSchema.safeParse({ ...verifyBase, code: "a".repeat(128) }).success,
    ).toBe(true)
  })

  it("rejects codes between the two accepted lengths and beyond the max", () => {
    expect(
      GuestRsvpVerifyRequestSchema.safeParse({ ...verifyBase, code: "12345" }).success,
    ).toBe(false)
    expect(
      GuestRsvpVerifyRequestSchema.safeParse({ ...verifyBase, code: "1234567" }).success,
    ).toBe(false)
    expect(
      GuestRsvpVerifyRequestSchema.safeParse({ ...verifyBase, code: "a".repeat(19) }).success,
    ).toBe(false)
    expect(
      GuestRsvpVerifyRequestSchema.safeParse({ ...verifyBase, code: "a".repeat(129) }).success,
    ).toBe(false)
  })

  it("applies the same channel <-> contact rule as the request step", () => {
    expect(
      GuestRsvpVerifyRequestSchema.safeParse({
        id: UUID,
        channel: "email",
        phone: PHONE,
        code: "123456",
      }).success,
    ).toBe(false)
  })
})

describe("guest cancel + roster shapes", () => {
  it("bounds the manage token", () => {
    expect(
      GuestRsvpCancelRequestSchema.safeParse({ token: "a".repeat(GUEST_MANAGE_TOKEN_MIN_LENGTH) })
        .success,
    ).toBe(true)
    expect(
      GuestRsvpCancelRequestSchema.safeParse({
        token: "a".repeat(GUEST_MANAGE_TOKEN_MIN_LENGTH - 1),
      }).success,
    ).toBe(false)
    expect(
      GuestRsvpCancelRequestSchema.safeParse({
        token: "a".repeat(GUEST_MANAGE_TOKEN_MAX_LENGTH + 1),
      }).success,
    ).toBe(false)
  })

  it("carries null contact fields after the retention scrub", () => {
    const scrubbed = CleanupGuestDTOSchema.parse({
      id: UUID,
      name: "Ada Lovelace",
      channel: "sms",
      email: null,
      phone: null,
      joinedAt: "2026-06-01T17:00:00.000Z",
      cancelledAt: null,
    })
    expect(scrubbed.phone).toBeNull()
    expect(scrubbed.cancelledAt).toBeNull()

    const response = GetCleanupGuestsResponseSchema.parse({ guests: [scrubbed], count: 1 })
    expect(response.guests).toHaveLength(1)
    expect(response.count).toBe(1)
  })
})

describe("additive fields", () => {
  const legacyCleanup = {
    id: UUID,
    title: "Park cleanup",
    type: "route",
    lat: 34.0,
    lng: -118.5,
    scheduledAt: "2026-06-01T17:00:00.000Z",
    status: "upcoming",
    organizer: person,
    going: 4,
    joined: true,
    bring: ["gloves"],
  }

  it("keeps CleanupDTO.guestCount optional", () => {
    expect(CleanupDTOSchema.parse(legacyCleanup).guestCount).toBeUndefined()
    expect(CleanupDTOSchema.parse({ ...legacyCleanup, guestCount: 3 }).guestCount).toBe(3)
  })

  it("keeps the session guest-SMS flag optional", () => {
    const user = {
      id: UUID2,
      displayName: "Ada",
      role: "citizen",
      createdAt: "2026-06-01T17:00:00.000Z",
    }
    expect(SessionResponseSchema.parse({ user }).guestSmsEnabled).toBeUndefined()
    expect(SessionResponseSchema.parse({ user, guestSmsEnabled: true }).guestSmsEnabled).toBe(true)

    const check = { authenticated: false, roles: [] }
    expect(SessionCheckResponseSchema.parse(check).guestSmsEnabled).toBeUndefined()
    expect(
      SessionCheckResponseSchema.parse({ ...check, guestSmsEnabled: false }).guestSmsEnabled,
    ).toBe(false)
  })

  it("keeps the new profile event fields optional", () => {
    const profile = { ...person, pastEvents: [], stats: { reports: 0, cleanups: 0 } }
    const parsed = UserProfileDTOSchema.parse(profile)
    expect(parsed.upcomingEvents).toBeUndefined()
    expect(parsed.pastEventsCursor).toBeUndefined()

    const hydrated = UserProfileDTOSchema.parse({
      ...profile,
      upcomingEvents: [legacyCleanup],
      pastEventsCursor: null,
    })
    expect(hydrated.upcomingEvents).toHaveLength(1)
    expect(hydrated.pastEventsCursor).toBeNull()
  })

  it("pages profile events with the shared pagination helpers", () => {
    const parsed = ProfileEventsRequestSchema.parse({ id: "ada", limit: "10" })
    expect(parsed.limit).toBe(10)
    expect(ProfileEventsRequestSchema.safeParse({ id: "ada", limit: 51 }).success).toBe(false)
    expect(ProfileEventsRequestSchema.safeParse({ id: "ada", page: 2 }).success).toBe(false)

    const page = ProfileEventsResponseSchema.parse({ items: [legacyCleanup], nextCursor: null })
    expect(page.items).toHaveLength(1)
    expect(page.nextCursor).toBeNull()
  })
})

describe("endpoint registry rows", () => {
  it("registers the guest RSVP surface as public v1 with no CSRF", () => {
    for (const name of ["guestRsvpRequest", "guestRsvpVerify", "guestRsvpCancel"] as const) {
      expect(endpoints[name].method).toBe("POST")
      expect(endpoints[name].auth).toBe("public")
      expect(endpoints[name].csrf).toBe(false)
      expect(endpoints[name].version).toBe("v1")
    }
    expect(endpoints.guestRsvpRequest.path).toBe("/cleanups/:id/guest-rsvp/request")
    expect(endpoints.guestRsvpVerify.path).toBe("/cleanups/:id/guest-rsvp/verify")
    expect(endpoints.guestRsvpCancel.path).toBe("/guest-rsvp/cancel")
  })

  it("keeps the guest roster behind auth and the profile events read auth-optional", () => {
    expect(endpoints.getCleanupGuests.method).toBe("GET")
    expect(endpoints.getCleanupGuests.path).toBe("/cleanups/:id/guests")
    expect(endpoints.getCleanupGuests.request).toBe(GetCleanupGuestsRequestSchema)
    expect(endpoints.getCleanupGuests.auth).toBe("required")

    expect(endpoints.getProfileEvents.method).toBe("GET")
    expect(endpoints.getProfileEvents.path).toBe("/people/:id/events")
    expect(endpoints.getProfileEvents.auth).toBe("optional")
    expect(endpoints.getProfileEvents.csrf).toBe(false)
  })
})

describe("FakeSmsSender", () => {
  it("captures sends with deterministic ids", async () => {
    const sms = new FakeSmsSender()
    const first = await sms.send(PHONE, "code 123456")
    const second = await sms.send(PHONE, "code 654321")
    expect(first.id).toBe("fake-sms-1")
    expect(second.id).toBe("fake-sms-2")
    expect(sms.sent).toHaveLength(2)
    expect(sms.lastFor(PHONE)?.body).toBe("code 654321")
    expect(sms.lastFor("+13105550100")).toBeUndefined()
  })

  it("resets its capture log and its id counter", async () => {
    const sms = new FakeSmsSender()
    await sms.send(PHONE, "one")
    sms.reset()
    expect(sms.sent).toHaveLength(0)
    expect((await sms.send(PHONE, "two")).id).toBe("fake-sms-1")
  })
})


describe("the OTP code space has one definition", () => {
  it("is the same schema the email sign-in verify uses", () => {
    expect(EmailOtpVerifyRequestSchema.shape.code).toBe(OtpCodeSchema)
    expect(GuestRsvpVerifyRequestSchema.innerType().shape.code).toBe(OtpCodeSchema)
  })
})

describe("guest roster pagination", () => {
  it("takes the shared cursor query alongside the event id", () => {
    const parsed = GetCleanupGuestsRequestSchema.parse({ id: UUID, limit: "25" })
    expect(parsed.limit).toBe(25)
    expect(GetCleanupGuestsRequestSchema.safeParse({ id: UUID }).success).toBe(true)
    expect(GetCleanupGuestsRequestSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false)
    expect(GetCleanupGuestsRequestSchema.safeParse({ id: UUID, limit: 51 }).success).toBe(false)
    expect(GetCleanupGuestsRequestSchema.safeParse({ id: UUID, page: 2 }).success).toBe(false)
  })

  it("carries a nextCursor that older payloads may omit", () => {
    const guest = {
      id: UUID,
      name: "Ada",
      channel: "sms",
      email: null,
      phone: null,
      joinedAt: "2026-06-01T17:00:00.000Z",
      cancelledAt: null,
    }
    expect(
      GetCleanupGuestsResponseSchema.parse({ guests: [guest], count: 1 }).nextCursor,
    ).toBeUndefined()
    expect(
      GetCleanupGuestsResponseSchema.parse({ guests: [guest], count: 90, nextCursor: "c1" })
        .nextCursor,
    ).toBe("c1")
  })
})

describe("guest response shapes", () => {
  it("parses the request step response", () => {
    expect(GuestRsvpRequestResponseSchema.parse({ sent: true, resendAfterSec: 30 })).toEqual({
      sent: true,
      resendAfterSec: 30,
    })
    expect(GuestRsvpRequestResponseSchema.safeParse({ sent: false, resendAfterSec: 30 }).success).toBe(
      false,
    )
  })

  it("refuses to mint a manage token the cancel endpoint would reject", () => {
    const ok = {
      joined: true,
      going: 5,
      manageToken: "t".repeat(GUEST_MANAGE_TOKEN_MIN_LENGTH),
    }
    expect(GuestRsvpVerifyResponseSchema.parse(ok).manageToken).toBe(ok.manageToken)
    expect(
      GuestRsvpVerifyResponseSchema.safeParse({
        ...ok,
        manageToken: "t".repeat(GUEST_MANAGE_TOKEN_MIN_LENGTH - 1),
      }).success,
    ).toBe(false)
    expect(
      GuestRsvpVerifyResponseSchema.safeParse({
        ...ok,
        manageToken: "t".repeat(GUEST_MANAGE_TOKEN_MAX_LENGTH + 1),
      }).success,
    ).toBe(false)
  })

  it("requires the contact keys to be present as explicit nulls once scrubbed", () => {
    const base = {
      id: UUID,
      name: "Ada",
      channel: "sms",
      joinedAt: "2026-06-01T17:00:00.000Z",
      cancelledAt: null,
    }
    expect(CleanupGuestDTOSchema.safeParse({ ...base, email: null, phone: null }).success).toBe(true)
    expect(CleanupGuestDTOSchema.safeParse({ ...base, phone: null }).success).toBe(false)
    expect(CleanupGuestDTOSchema.safeParse({ ...base, email: null }).success).toBe(false)
  })
})

describe("typed client wiring for the new endpoints", () => {
  function harness() {
    const calls: Array<{ url: string; body: unknown }> = []
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({
        url: String(url),
        body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      })
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }) as unknown as typeof fetch
    return { calls, client: createApiClient({ baseURL: "https://api.civfix.test", fetchImpl }) }
  }

  it("fills :id from the body on the guest RSVP writes and keeps it in the payload", async () => {
    const { calls, client } = harness()
    await client.guestRsvpRequest({
      id: UUID,
      name: "Ada",
      channel: "sms",
      phone: PHONE,
      turnstileToken: "tk",
    })
    expect(calls[0]?.url).toBe(`https://api.civfix.test/v1/cleanups/${UUID}/guest-rsvp/request`)
    expect((calls[0]?.body as { id: string }).id).toBe(UUID)
  })

  it("consumes :id from the query on the paged reads", async () => {
    const { calls, client } = harness()
    await client.getProfileEvents({ id: "ada", limit: 10 })
    expect(calls[0]?.url).toBe("https://api.civfix.test/v1/people/ada/events?limit=10")

    await client.getCleanupGuests({ id: UUID, cursor: "c1" })
    expect(calls[1]?.url).toBe(`https://api.civfix.test/v1/cleanups/${UUID}/guests?cursor=c1`)
  })
})
