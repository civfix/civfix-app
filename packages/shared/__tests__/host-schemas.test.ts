import { describe, it, expect } from "vitest"
import { z } from "zod"
import {
  BroadcastChannelSchema,
  BroadcastKindSchema,
  BroadcastSegmentSchema,
  BroadcastStatusSchema,
  CheckinMethodSchema,
  CleanupMemberRoleSchema,
  ConsentSurfaceSchema,
  DeliveryStatusSchema,
  EventPageBlockKindSchema,
  EventPageStatusSchema,
  EventQuestionKindSchema,
  EventVisibilitySchema,
  HOST_CAPABILITY_VALUES,
  HostCapabilitySchema,
  HostExportKindSchema,
  HostExportStatusSchema,
  LegalDocumentTypeSchema,
  MediaPurposeSchema,
  OrganizationMemberRoleSchema,
  OrgVerificationKindSchema,
  OrgVerificationStatusSchema,
  PageViewSourceSchema,
  RegistrationSourceSchema,
  RegistrationStatusSchema,
  SeatStatusSchema,
  ThemeAccentSchema,
  TicketTypeVisibilitySchema,
  WaitlistStatusSchema,
} from "../src/schemas/common.js"
import { NotificationTypeSchema } from "../src/schemas/notifications.js"
import { SignalTopicSchema } from "../src/types/ws.js"
import {
  CleanupDTOSchema,
  EventPageBlockSchema,
  EventRegistrationDTOSchema,
  HostedEventDTOSchema,
  MoneyDTOSchema,
  OrganizationDTOSchema,
  TicketTypeDTOSchema,
} from "../src/schemas/entities.js"
import {
  AcceptOrganizationInviteRequestSchema,
  AcceptOrganizationInviteResponseSchema,
  CreateOrganizationRequestSchema,
  InviteOrganizationMemberResponseSchema,
  ListOrganizationInvitesResponseSchema,
  MAX_ORG_INVITES_PER_ORG,
  OrganizationInviteDTOSchema,
  OrgSlugSchema,
  RevokeOrganizationInviteRequestSchema,
} from "../src/schemas/host/organizations.js"
import { EventQuestionDefSchema } from "../src/schemas/host/questions.js"
import {
  EventConsentInputSchema,
  RegisterForEventRequestSchema,
  RegisterOutcomeSchema,
} from "../src/schemas/host/registrations.js"
import { PageSlugSchema, SaveEventPageRequestSchema } from "../src/schemas/host/pages.js"
import {
  CreateEventBroadcastRequestSchema,
  UnsubscribeBroadcastsRequestSchema,
  hostBroadcastChannelsValid,
} from "../src/schemas/host/broadcasts.js"
import {
  ANALYTICS_SUPPRESSION_K,
  EventAnalyticsOverviewResponseSchema,
  SuppressedRateSchema,
} from "../src/schemas/host/analytics.js"
import {
  GuestRsvpVerifyResponseSchema,
  SetMemberRoleRequestSchema,
} from "../src/schemas/cleanups.js"
import {
  AcceptMyEventInviteRequestSchema,
  AcceptMyEventInviteResponseSchema,
  DeclineMyEventInviteRequestSchema,
  DeclineMyEventInviteResponseSchema,
  EventTeamInviteStatusSchema,
  EventTeamRoleSchema,
  InviteEventTeamMemberRequestSchema,
  ListMyEventInvitesRequestSchema,
  ListMyEventInvitesResponseSchema,
  PendingEventTeamInviteDTOSchema,
} from "../src/schemas/host/team.js"

const UUID = "123e4567-e89b-12d3-a456-426614174000"
const UUID2 = "123e4567-e89b-12d3-a456-426614174001"
const ISO = "2026-09-01T10:00:00.000Z"

describe("host platform enum tuples (mirrored byte-identical by the backend)", () => {
  it("appends staff then coordinator LAST to CleanupMemberRole", () => {
    expect([...CleanupMemberRoleSchema.options]).toEqual([
      "organizer",
      "cohost",
      "member",
      "staff",
      "coordinator",
    ])
  })

  it("appends the three host media purposes LAST, in order", () => {
    expect([...MediaPurposeSchema.options]).toEqual([
      "report",
      "verification",
      "post",
      "event_cover",
      "event_gallery",
      "org_logo",
    ])
  })

  it("keeps event_broadcast then event_team_invite at the tail of NotificationType and host LAST in SignalTopic", () => {
    expect(NotificationTypeSchema.options.at(-2)).toBe("event_broadcast")
    expect(NotificationTypeSchema.options.at(-1)).toBe("event_team_invite")
    expect([...SignalTopicSchema.options]).toEqual([
      "notifications",
      "threads",
      "reports",
      "host",
    ])
  })

  it("pins every new enum tuple exactly", () => {
    expect([...EventVisibilitySchema.options]).toEqual(["public", "unlisted", "private"])
    expect([...OrganizationMemberRoleSchema.options]).toEqual(["owner", "admin", "member"])
    expect([...OrgVerificationStatusSchema.options]).toEqual([
      "unverified",
      "pending",
      "verified",
      "rejected",
    ])
    expect([...OrgVerificationKindSchema.options]).toEqual([
      "nonprofit",
      "government",
      "community",
    ])
    expect([...TicketTypeVisibilitySchema.options]).toEqual(["public", "hidden", "access_code"])
    expect([...RegistrationStatusSchema.options]).toEqual([
      "registered",
      "cancelled",
      "transferred",
    ])
    expect([...RegistrationSourceSchema.options]).toEqual([
      "self",
      "waitlist",
      "walkup",
      "transfer",
    ])
    expect([...SeatStatusSchema.options]).toEqual(["active", "cancelled"])
    expect([...CheckinMethodSchema.options]).toEqual(["scan", "manual", "self", "walkup"])
    expect([...WaitlistStatusSchema.options]).toEqual([
      "waiting",
      "offered",
      "claimed",
      "expired",
      "cancelled",
    ])
    expect([...EventQuestionKindSchema.options]).toEqual([
      "short_text",
      "long_text",
      "single_select",
      "multi_select",
      "checkbox",
      "consent",
    ])
    expect([...EventPageStatusSchema.options]).toEqual(["draft", "published", "unpublished"])
    expect([...EventPageBlockKindSchema.options]).toEqual([
      "hero",
      "about",
      "agenda",
      "hosts",
      "faq",
      "location",
      "sponsors",
      "donate",
      "registration",
      "contact",
    ])
    expect([...ThemeAccentSchema.options]).toEqual(["bloom", "moss", "sun", "sky", "lilac"])
    expect([...HostExportKindSchema.options]).toEqual([
      "roster",
      "answers",
      "checkins",
      "donations",
    ])
    expect([...HostExportStatusSchema.options]).toEqual([
      "queued",
      "running",
      "ready",
      "failed",
      "expired",
    ])
    expect([...BroadcastKindSchema.options]).toEqual([
      "host_broadcast",
      "confirmation",
      "waitlist_promoted",
      "reminder",
      "event_updated",
      "event_cancelled",
      "thank_you",
    ])
    expect([...BroadcastStatusSchema.options]).toEqual([
      "draft",
      "scheduled",
      "sending",
      "sent",
      "cancelled",
      "failed",
    ])
    expect([...BroadcastChannelSchema.options]).toEqual(["inapp", "push", "email", "sms"])
    expect([...DeliveryStatusSchema.options]).toEqual([
      "pending",
      "in_flight",
      "sent",
      "failed",
      "suppressed",
      "skipped",
    ])
    expect([...PageViewSourceSchema.options]).toEqual([
      "direct",
      "search",
      "social",
      "referral",
      "app",
      "other",
    ])
    expect([...LegalDocumentTypeSchema.options]).toEqual([
      "terms",
      "privacy",
      "cookies",
      "subprocessors",
      "donations",
      "org_donation_agreement",
      "donation_disclosure",
    ])
    expect([...ConsentSurfaceSchema.options]).toEqual([
      "web_donate",
      "web_org_settings",
      "web_register",
      "mobile_register",
      "onboarding",
    ])
  })

  it("enumerates the 18 host capabilities in a stable order", () => {
    expect(HOST_CAPABILITY_VALUES).toHaveLength(18)
    expect(HOST_CAPABILITY_VALUES).toBe(HostCapabilitySchema.options)
    expect(HOST_CAPABILITY_VALUES[0]).toBe("view_event_private")
    expect(HOST_CAPABILITY_VALUES.at(-2)).toBe("manage_payments")
    expect(HOST_CAPABILITY_VALUES.at(-1)).toBe("view_donations")
    expect(HostCapabilitySchema.safeParse("delete_everything").success).toBe(false)
  })
})

describe("BroadcastSegment discriminated union", () => {
  it("accepts every v1 branch and rejects a compound segment", () => {
    expect(BroadcastSegmentSchema.parse({ kind: "all_registered" })).toEqual({
      kind: "all_registered",
    })
    expect(
      BroadcastSegmentSchema.parse({ kind: "ticket_types", ids: [UUID, UUID2] }),
    ).toEqual({ kind: "ticket_types", ids: [UUID, UUID2] })
    for (const kind of ["waitlist", "checked_in", "not_checked_in", "guests_only"]) {
      expect(BroadcastSegmentSchema.safeParse({ kind }).success).toBe(true)
    }
    expect(BroadcastSegmentSchema.safeParse({ kind: "ticket_types", ids: [] }).success).toBe(false)
    expect(
      BroadcastSegmentSchema.safeParse({ kind: "all_registered", also: "waitlist" }).success,
    ).toBe(false)
    expect(BroadcastSegmentSchema.safeParse({ kind: "everyone_on_the_platform" }).success).toBe(
      false,
    )
  })

  it("caps a ticket-type segment at 20 ids", () => {
    const ids = Array.from({ length: 21 }, () => UUID)
    expect(BroadcastSegmentSchema.safeParse({ kind: "ticket_types", ids }).success).toBe(false)
  })
})

describe("additive DTO growth stays backward compatible", () => {
  const minimalCleanup = {
    id: UUID,
    title: "Sweep",
    type: "site",
    scheduledAt: ISO,
    status: "upcoming",
    organizer: { id: UUID, name: "Org", followers: 0, following: 0, isFollowing: false },
    going: 0,
    joined: false,
    bring: [],
    lat: 34,
    lng: -118,
  }

  it("parses a pre-0.40.0 CleanupDTO and defaults every host field", () => {
    const parsed = CleanupDTOSchema.parse(minimalCleanup)
    expect(parsed.visibility).toBe("public")
    expect(parsed.galleryUrls).toEqual([])
    expect(parsed.ticketTypes).toEqual([])
    expect(parsed.myCapabilities).toEqual([])
    expect(parsed.endsAt).toBeUndefined()
    expect(parsed.donationOrg).toBeUndefined()
  })

  it("carries the host fields when the server sends them", () => {
    const parsed = CleanupDTOSchema.parse({
      ...minimalCleanup,
      endsAt: ISO,
      timezone: "America/Los_Angeles",
      visibility: "unlisted",
      pageSlug: "beach-sweep",
      registrationState: "waitlist",
      myCapabilities: ["view_roster", "check_in"],
      donationOrg: { slug: "reach-out-la", name: "Reach Out LA", enabled: true },
      organization: { id: UUID2, slug: "reach-out-la", name: "Reach Out LA", verified: true },
    })
    expect(parsed.visibility).toBe("unlisted")
    expect(parsed.myCapabilities).toEqual(["view_roster", "check_in"])
    expect(parsed.donationOrg?.enabled).toBe(true)
    expect(parsed.organization?.verified).toBe(true)
  })

  it("defaults OrganizationDTO.verifiedStatus and leaves the donation fields absent", () => {
    const org = OrganizationDTOSchema.parse({
      id: UUID,
      slug: "reach-out-la",
      name: "Reach Out LA",
      createdAt: ISO,
    })
    expect(org.verifiedStatus).toBe("unverified")
    expect(org.donationsEnabled).toBeUndefined()
    expect(org.donateSlug).toBeUndefined()
  })

  it("defaults the ticket-type counters", () => {
    const t = TicketTypeDTOSchema.parse({ id: UUID, cleanupId: UUID2, name: "General" })
    expect(t.reserved).toBe(0)
    expect(t.sold).toBe(0)
    expect(t.visibility).toBe("public")
    expect(t.maxPartySize).toBe(1)
    expect(t.questionIds).toEqual([])
  })

  it("keeps email and phone off the registration DTO", () => {
    const reg = EventRegistrationDTOSchema.parse({
      id: UUID,
      cleanupId: UUID2,
      kind: "guest",
      guestName: "Dana",
      registeredAt: ISO,
    })
    expect(Object.keys(reg)).not.toContain("email")
    expect(Object.keys(reg)).not.toContain("phone")
    expect(reg.seats).toEqual([])
    expect(reg.status).toBe("registered")
  })

  it("gives the portfolio row its own startsAt read model", () => {
    const row = HostedEventDTOSchema.parse({
      id: UUID,
      title: "Sweep",
      startsAt: ISO,
      status: "upcoming",
    })
    expect(row.startsAt).toBe(ISO)
    expect(row.registeredCount).toBe(0)
    expect(row.myCapabilities).toEqual([])
  })

  it("adds registration + ticket tokens to the guest verify response without breaking the old shape", () => {
    const parsed = GuestRsvpVerifyResponseSchema.parse({
      joined: true,
      going: 3,
      manageToken: "x".repeat(24),
    })
    expect(parsed.ticketTokens).toEqual([])
    expect(parsed.registration).toBeUndefined()
  })
})

describe("registration request contract", () => {
  it("requires an idempotency key and rejects unknown keys", () => {
    const ok = RegisterForEventRequestSchema.safeParse({
      id: UUID,
      idempotencyKey: "abcd1234efgh",
    })
    expect(ok.success).toBe(true)
    expect(ok.success && ok.data.partySize).toBe(1)
    expect(
      RegisterForEventRequestSchema.safeParse({ id: UUID, idempotencyKey: "short" }).success,
    ).toBe(false)
    expect(
      RegisterForEventRequestSchema.safeParse({
        id: UUID,
        idempotencyKey: "abcd1234efgh",
        surpriseMe: true,
      }).success,
    ).toBe(false)
  })

  it("caps party size at 10", () => {
    expect(
      RegisterForEventRequestSchema.safeParse({
        id: UUID,
        idempotencyKey: "abcd1234efgh",
        partySize: 11,
      }).success,
    ).toBe(false)
  })

  it("never lets the client stamp its own consent time", () => {
    expect(
      EventConsentInputSchema.safeParse({
        termsVersion: "2026-01-01",
        disclosureVersion: "2026-01-01",
        hostContactOptIn: true,
        acceptedAt: "1999-01-01T00:00:00.000Z",
      }).success,
    ).toBe(false)
  })

  it("enumerates every register outcome the service can produce", () => {
    expect(RegisterOutcomeSchema.options).toContain("registered")
    expect(RegisterOutcomeSchema.options).toContain("full")
    expect(RegisterOutcomeSchema.options).toContain("access_code_required")
    expect(RegisterOutcomeSchema.options).toContain("party_too_large")
    expect(new Set(RegisterOutcomeSchema.options).size).toBe(RegisterOutcomeSchema.options.length)
  })
})

describe("question definitions and page blocks", () => {
  it("discriminates a select question on its options", () => {
    expect(
      EventQuestionDefSchema.safeParse({
        kind: "single_select",
        prompt: "Shirt size",
        options: [{ value: "s", label: "Small" }],
      }).success,
    ).toBe(true)
    expect(
      EventQuestionDefSchema.safeParse({ kind: "single_select", prompt: "Shirt size" }).success,
    ).toBe(false)
    expect(
      EventQuestionDefSchema.safeParse({ kind: "consent", prompt: "Waiver" }).success,
    ).toBe(false)
    expect(
      EventQuestionDefSchema.safeParse({
        kind: "consent",
        prompt: "Waiver",
        consentText: "I accept",
      }).success,
    ).toBe(true)
  })

  it("rejects an unknown block kind and an unknown key inside a known one", () => {
    expect(EventPageBlockSchema.safeParse({ id: "b1", kind: "hero" }).success).toBe(true)
    expect(EventPageBlockSchema.safeParse({ id: "b1", kind: "iframe" }).success).toBe(false)
    expect(
      EventPageBlockSchema.safeParse({ id: "b1", kind: "hero", html: "<script>" }).success,
    ).toBe(false)
  })

  it("caps a page at 24 blocks", () => {
    const blocks = Array.from({ length: 25 }, (_, i) => ({ id: `b${i}`, kind: "hero" as const }))
    expect(SaveEventPageRequestSchema.safeParse({ id: UUID, blocks }).success).toBe(false)
    expect(
      SaveEventPageRequestSchema.safeParse({ id: UUID, blocks: blocks.slice(0, 24) }).success,
    ).toBe(true)
  })
})

describe("slugs", () => {
  it("accepts lowercase hyphenated slugs and rejects the rest", () => {
    for (const schema of [OrgSlugSchema, PageSlugSchema]) {
      expect(schema.parse("Reach-Out-LA")).toBe("reach-out-la")
      expect(schema.safeParse("has space").success).toBe(false)
      expect(schema.safeParse("-leading").success).toBe(false)
      expect(schema.safeParse("trailing-").success).toBe(false)
      expect(schema.safeParse("double--hyphen").success).toBe(false)
      expect(schema.safeParse("ab").success).toBe(false)
      expect(schema.safeParse("a/b").success).toBe(false)
    }
  })
})

describe("broadcast composition", () => {
  it("requires https on a CTA link and at least one channel", () => {
    const base = {
      id: UUID,
      subject: "See you Saturday",
      bodyMd: "Bring gloves.",
      segment: { kind: "all_registered" as const },
      channels: ["email" as const],
    }
    expect(CreateEventBroadcastRequestSchema.safeParse(base).success).toBe(true)
    expect(
      CreateEventBroadcastRequestSchema.safeParse({ ...base, ctaUrl: "http://civfix.org" }).success,
    ).toBe(false)
    expect(
      CreateEventBroadcastRequestSchema.safeParse({
        ...base,
        ctaUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false)
    expect(CreateEventBroadcastRequestSchema.safeParse({ ...base, channels: [] }).success).toBe(
      false,
    )
    expect(
      CreateEventBroadcastRequestSchema.safeParse({ ...base, channels: ["sms"] }).success,
    ).toBe(false)
  })

  it("refuses push without inapp: a push rides the in-app notification", () => {
    const base = {
      id: UUID,
      subject: "See you Saturday",
      bodyMd: "Bring gloves.",
      segment: { kind: "all_registered" as const },
    }
    expect(
      CreateEventBroadcastRequestSchema.safeParse({ ...base, channels: ["push"] }).success,
    ).toBe(false)
    expect(
      CreateEventBroadcastRequestSchema.safeParse({ ...base, channels: ["push", "email"] }).success,
    ).toBe(false)
    expect(
      CreateEventBroadcastRequestSchema.safeParse({ ...base, channels: ["inapp", "push"] }).success,
    ).toBe(true)
    expect(
      CreateEventBroadcastRequestSchema.safeParse({ ...base, channels: ["inapp"] }).success,
    ).toBe(true)
    expect(hostBroadcastChannelsValid(["push"])).toBe(false)
    expect(hostBroadcastChannelsValid(["inapp", "push", "email"])).toBe(true)
  })

  it("takes only a token on the public unsubscribe endpoint", () => {
    expect(
      UnsubscribeBroadcastsRequestSchema.safeParse({ token: "u1.".padEnd(40, "a") }).success,
    ).toBe(true)
    expect(
      UnsubscribeBroadcastsRequestSchema.safeParse({
        token: "u1.".padEnd(40, "a"),
        email: "a@b.com",
      }).success,
    ).toBe(false)
  })
})

describe("analytics envelopes carry suppression, never opens or clicks", () => {
  it("defaults k to 5 and allows a null (suppressed) count", () => {
    const parsed = EventAnalyticsOverviewResponseSchema.parse({
      generatedAt: ISO,
      range: "30d",
      kpis: {
        registered: 12,
        checkedIn: null,
        waitlisted: null,
        cancelled: null,
        noShow: null,
        capacity: 40,
        pageViews: 210,
        donationClicks: null,
      },
      checkInRate: { value: null, numerator: null, denominator: null, suppressed: true },
      noShowRate: { value: null, numerator: null, denominator: null, suppressed: true },
      capacityUtilization: { value: 0.3, numerator: 12, denominator: 40, suppressed: false },
    })
    expect(parsed.k).toBe(ANALYTICS_SUPPRESSION_K)
    expect(parsed.kpis.checkedIn).toBeNull()
    expect(parsed.funnel).toEqual([])
    expect(Object.keys(parsed)).not.toContain("opens")
    expect(Object.keys(parsed)).not.toContain("clicks")
  })

  it("models a rate as null rather than zero when it is suppressed", () => {
    const r = SuppressedRateSchema.parse({
      value: null,
      numerator: null,
      denominator: null,
      suppressed: true,
    })
    expect(r.value).toBeNull()
    expect(r.suppressed).toBe(true)
  })
})

describe("money is always integer minor units", () => {
  it("rejects a float amount and a non-USD currency", () => {
    expect(MoneyDTOSchema.safeParse({ amountMinor: 2500, currency: "USD" }).success).toBe(true)
    expect(MoneyDTOSchema.safeParse({ amountMinor: 25.5, currency: "USD" }).success).toBe(false)
    expect(MoneyDTOSchema.safeParse({ amountMinor: 2500, currency: "EUR" }).success).toBe(false)
  })
})

describe("organization creation", () => {
  it("requires https on the website and rejects an unknown key", () => {
    const base = { name: "Reach Out LA", slug: "reach-out-la" }
    expect(CreateOrganizationRequestSchema.safeParse(base).success).toBe(true)
    expect(
      CreateOrganizationRequestSchema.safeParse({ ...base, websiteUrl: "http://x.org" }).success,
    ).toBe(false)
    expect(
      CreateOrganizationRequestSchema.safeParse({ ...base, websiteUrl: "https://x.org" }).success,
    ).toBe(true)
    expect(
      CreateOrganizationRequestSchema.safeParse({ ...base, verifiedStatus: "verified" }).success,
    ).toBe(false)
  })
})

describe("organization invites (0.41.0)", () => {
  const person = { id: UUID2, name: "Ada", followers: 0, following: 0, isFollowing: false }
  const emailInvite = {
    id: UUID,
    organizationId: UUID2,
    email: "ada@example.org",
    user: null,
    role: "member",
    status: "pending",
    invitedBy: person,
    createdAt: ISO,
    expiresAt: ISO,
  }

  it("round-trips an email invite and a handle invite", () => {
    expect(OrganizationInviteDTOSchema.safeParse(emailInvite).success).toBe(true)
    expect(
      OrganizationInviteDTOSchema.safeParse({
        ...emailInvite,
        email: null,
        user: person,
        role: "admin",
        status: "accepted",
        invitedBy: null,
      }).success,
    ).toBe(true)
    expect(OrganizationInviteDTOSchema.safeParse({ ...emailInvite, role: "owner" }).success).toBe(
      false,
    )
    expect(
      OrganizationInviteDTOSchema.safeParse({ ...emailInvite, status: "declined" }).success,
    ).toBe(false)
    expect(
      ListOrganizationInvitesResponseSchema.safeParse({ items: [emailInvite] }).success,
    ).toBe(true)
    expect(MAX_ORG_INVITES_PER_ORG).toBe(50)
  })

  it("keeps the 0.40.0 invite response parsing and adds the pending record additively", () => {
    const legacy = { ok: true, member: null, invited: true }
    const r = InviteOrganizationMemberResponseSchema.safeParse(legacy)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.invite).toBeUndefined()
    expect(
      InviteOrganizationMemberResponseSchema.safeParse({ ...legacy, invite: emailInvite }).success,
    ).toBe(true)
    expect(
      InviteOrganizationMemberResponseSchema.safeParse({ ...legacy, invite: null }).success,
    ).toBe(true)
  })

  it("revokes by org + invite id, and accepts by capability token alone", () => {
    expect(
      RevokeOrganizationInviteRequestSchema.safeParse({ id: UUID, inviteId: UUID2 }).success,
    ).toBe(true)
    expect(RevokeOrganizationInviteRequestSchema.safeParse({ id: UUID }).success).toBe(false)
    const token = "a".repeat(32)
    expect(AcceptOrganizationInviteRequestSchema.safeParse({ token }).success).toBe(true)
    expect(AcceptOrganizationInviteRequestSchema.safeParse({ token, id: UUID }).success).toBe(false)
    expect(AcceptOrganizationInviteRequestSchema.safeParse({ token: "short" }).success).toBe(false)
    expect(
      AcceptOrganizationInviteRequestSchema.safeParse({ token: "a".repeat(129) }).success,
    ).toBe(false)
    expect(
      AcceptOrganizationInviteResponseSchema.safeParse({
        ok: true,
        organization: { id: UUID2, slug: "reach-out-la", name: "Reach Out LA", createdAt: ISO },
        role: "member",
      }).success,
    ).toBe(true)
    // The response reports the SEATED role: an existing owner accepting an invite stays owner.
    expect(
      AcceptOrganizationInviteResponseSchema.safeParse({
        ok: true,
        organization: { id: UUID2, slug: "reach-out-la", name: "Reach Out LA", createdAt: ISO },
        role: "owner",
      }).success,
    ).toBe(true)
    expect(
      OrganizationDTOSchema.safeParse({
        id: UUID2,
        slug: "reach-out-la",
        name: "Reach Out LA",
        createdAt: ISO,
        suspended: true,
      }).success,
    ).toBe(true)
  })
})

describe("TS7056-prone schemas keep a usable inferred type", () => {
  it("stays assignable inside another schema without a structural blow-up", () => {
    const wrapper = z.object({
      cleanup: CleanupDTOSchema,
      page: EventPageBlockSchema,
      question: EventQuestionDefSchema,
      registration: EventRegistrationDTOSchema,
      hosted: HostedEventDTOSchema,
      segment: BroadcastSegmentSchema,
    })
    expect(wrapper.safeParse({}).success).toBe(false)
  })
})

describe("event collaborators: the coordinator tier and the invitee inbox (DECISIONS §33)", () => {
  const eventRef = {
    id: UUID2,
    title: "Ballona Creek sweep",
    startsAt: ISO,
    status: "upcoming",
  }

  const pendingInvite = {
    id: UUID,
    role: "coordinator",
    event: eventRef,
    invitedBy: null,
    createdAt: ISO,
    expiresAt: ISO,
  }

  const minimalCleanup = {
    id: UUID2,
    title: "Ballona Creek sweep",
    type: "site",
    scheduledAt: ISO,
    status: "upcoming",
    organizer: { id: UUID, name: "Org", followers: 0, following: 0, isFollowing: false },
    going: 0,
    joined: false,
    bring: [],
    lat: 34,
    lng: -118,
  }

  it("offers three invitable tiers and appends coordinator LAST", () => {
    expect([...EventTeamRoleSchema.options]).toEqual(["cohost", "staff", "coordinator"])
    expect(EventTeamRoleSchema.safeParse("organizer").success).toBe(false)
    expect(EventTeamRoleSchema.safeParse("member").success).toBe(false)
    for (const role of EventTeamRoleSchema.options) {
      expect(CleanupMemberRoleSchema.safeParse(role).success, role).toBe(true)
    }
  })

  it("appends declined LAST to the invite status, beside revoked", () => {
    expect([...EventTeamInviteStatusSchema.options]).toEqual([
      "pending",
      "accepted",
      "revoked",
      "expired",
      "declined",
    ])
  })

  it("lets a host invite and seat a coordinator", () => {
    expect(
      InviteEventTeamMemberRequestSchema.safeParse({
        id: UUID,
        identifierKind: "handle",
        identifier: "ada",
        role: "coordinator",
      }).success,
    ).toBe(true)
    expect(
      SetMemberRoleRequestSchema.safeParse({ id: UUID, userId: UUID2, role: "coordinator" }).success,
    ).toBe(true)
    expect(
      SetMemberRoleRequestSchema.safeParse({ id: UUID, userId: UUID2, role: "organizer" }).success,
    ).toBe(false)
  })

  it("carries no email on the invitee-side DTO", () => {
    const parsed = PendingEventTeamInviteDTOSchema.parse(pendingInvite)
    expect(Object.keys(parsed).sort()).toEqual([
      "createdAt",
      "event",
      "expiresAt",
      "id",
      "invitedBy",
      "role",
    ])
    expect(
      PendingEventTeamInviteDTOSchema.safeParse({
        ...pendingInvite,
        email: "ada@example.org",
      }).success,
    ).toBe(true)
    expect((PendingEventTeamInviteDTOSchema.parse({
      ...pendingInvite,
      email: "ada@example.org",
    }) as Record<string, unknown>).email).toBeUndefined()
  })

  it("keeps the invited event a lean ref: no roster counters, no capabilities", () => {
    const parsed = PendingEventTeamInviteDTOSchema.parse({
      ...pendingInvite,
      event: { ...eventRef, endsAt: ISO, coverThumbUrl: "https://cdn/x.jpg", address: "Playa" },
    })
    expect(Object.keys(parsed.event).sort()).toEqual([
      "address",
      "coverThumbUrl",
      "endsAt",
      "id",
      "startsAt",
      "status",
      "title",
    ])
    expect(PendingEventTeamInviteDTOSchema.parse(pendingInvite).event.address).toBeUndefined()
  })

  it("requires an expiry and an id, and rejects an unseatable role", () => {
    const { expiresAt: _expiresAt, ...noExpiry } = pendingInvite
    expect(PendingEventTeamInviteDTOSchema.safeParse(noExpiry).success).toBe(false)
    expect(
      PendingEventTeamInviteDTOSchema.safeParse({ ...pendingInvite, role: "organizer" }).success,
    ).toBe(false)
  })

  it("pages the inbox with the shared cursor helpers and rejects unknown query keys", () => {
    expect(ListMyEventInvitesRequestSchema.safeParse({}).success).toBe(true)
    expect(ListMyEventInvitesRequestSchema.safeParse({ cursor: "c", limit: 20 }).success).toBe(true)
    expect(ListMyEventInvitesRequestSchema.safeParse({ limit: 51 }).success).toBe(false)
    expect(ListMyEventInvitesRequestSchema.safeParse({ eventId: UUID }).success).toBe(false)
    expect(
      ListMyEventInvitesResponseSchema.safeParse({ items: [pendingInvite], nextCursor: null })
        .success,
    ).toBe(true)
  })

  it("accepts and declines by invite id alone, strictly", () => {
    for (const schema of [AcceptMyEventInviteRequestSchema, DeclineMyEventInviteRequestSchema]) {
      expect(schema.safeParse({ inviteId: UUID }).success).toBe(true)
      expect(schema.safeParse({}).success).toBe(false)
      expect(schema.safeParse({ inviteId: UUID, token: "a".repeat(32) }).success).toBe(false)
      expect(schema.safeParse({ inviteId: UUID, id: UUID2 }).success).toBe(false)
      expect(schema.safeParse({ inviteId: "not-a-uuid" }).success).toBe(false)
    }
  })

  it("answers an accept with the SEATED role and the full event", () => {
    const ok = AcceptMyEventInviteResponseSchema.safeParse({
      ok: true,
      role: "coordinator",
      event: minimalCleanup,
    })
    expect(ok.success).toBe(true)
    expect(
      AcceptMyEventInviteResponseSchema.safeParse({
        ok: true,
        role: "organizer",
        event: minimalCleanup,
      }).success,
    ).toBe(true)
    expect(
      AcceptMyEventInviteResponseSchema.safeParse({ ok: true, role: "coordinator" }).success,
    ).toBe(false)
    expect(DeclineMyEventInviteResponseSchema.safeParse({ ok: true }).success).toBe(true)
    expect(DeclineMyEventInviteResponseSchema.safeParse({ ok: false }).success).toBe(false)
  })
})
