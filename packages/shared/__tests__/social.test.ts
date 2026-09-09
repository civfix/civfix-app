import { describe, it, expect } from "vitest"
import { UpdateSettingsRequestSchema, UserProfileDTOSchema } from "../src/schemas/social.js"
import { UserDTOSchema } from "../src/schemas/auth.js"
import { NotificationTypeSchema, NotificationPrefsDTOSchema } from "../src/schemas/notifications.js"


const UUID = "123e4567-e89b-12d3-a456-426614174000"

const profile = (extra: Record<string, unknown> = {}) => ({
  id: UUID,
  name: "Jane",
  avatar: ["#FF7A6B", "#6FB36F"],
  followers: 2,
  following: 1,
  isFollowing: false,
  pastEvents: [],
  stats: { reports: 4, cleanups: 2 },
  ...extra,
})

const user = (extra: Record<string, unknown> = {}) => ({
  id: UUID,
  displayName: "Jane",
  role: "citizen",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...extra,
})

describe("UpdateSettingsRequestSchema — showVolunteerHours", () => {
  it("accepts the flag on its own", () => {
    expect(UpdateSettingsRequestSchema.parse({ showVolunteerHours: false })).toEqual({
      showVolunteerHours: false,
    })
    expect(UpdateSettingsRequestSchema.parse({ showVolunteerHours: true })).toEqual({
      showVolunteerHours: true,
    })
  })

  it("accepts it alongside the existing settings, and omitted entirely", () => {
    const parsed = UpdateSettingsRequestSchema.parse({
      allowDirectMessages: true,
      locale: "es",
      showVolunteerHours: false,
    })
    expect(parsed.showVolunteerHours).toBe(false)
    expect(UpdateSettingsRequestSchema.parse({}).showVolunteerHours).toBeUndefined()
    expect(UpdateSettingsRequestSchema.parse({ locale: "en" }).showVolunteerHours).toBeUndefined()
  })

  it("stays strict and boolean-typed", () => {
    expect(UpdateSettingsRequestSchema.safeParse({ showVolunteerHour: false }).success).toBe(false)
    expect(UpdateSettingsRequestSchema.safeParse({ showVolunteerHours: "false" }).success).toBe(
      false,
    )
    expect(UpdateSettingsRequestSchema.safeParse({ showVolunteerHours: null }).success).toBe(false)
  })
})

describe("UserProfileDTOSchema — showVolunteerHours", () => {
  it("parses a legacy payload that omits the flag (older servers)", () => {
    const parsed = UserProfileDTOSchema.parse(profile({ volunteerHours: 12 }))
    expect(parsed.showVolunteerHours).toBeUndefined()
    expect(parsed.volunteerHours).toBe(12)
  })

  it("parses your own profile, where the flag renders the settings toggle", () => {
    const parsed = UserProfileDTOSchema.parse(
      profile({ volunteerHours: 12, showVolunteerHours: true }),
    )
    expect(parsed.showVolunteerHours).toBe(true)
  })

  it("distinguishes hidden (flag false + hours ABSENT) from genuinely zero", () => {
    const hidden = UserProfileDTOSchema.parse(profile({ showVolunteerHours: false }))
    expect(hidden.showVolunteerHours).toBe(false)
    expect(hidden.volunteerHours).toBeUndefined()

    const zero = UserProfileDTOSchema.parse(
      profile({ showVolunteerHours: true, volunteerHours: 0 }),
    )
    expect(zero.volunteerHours).toBe(0)
  })

  it("rejects a non-boolean flag", () => {
    expect(UserProfileDTOSchema.safeParse(profile({ showVolunteerHours: "no" })).success).toBe(
      false,
    )
  })
})

describe("UserDTOSchema — showVolunteerHours", () => {
  it("parses with and without the flag", () => {
    expect(UserDTOSchema.parse(user()).showVolunteerHours).toBeUndefined()
    expect(UserDTOSchema.parse(user({ showVolunteerHours: false })).showVolunteerHours).toBe(false)
    expect(UserDTOSchema.parse(user({ showVolunteerHours: true })).showVolunteerHours).toBe(true)
  })

  it("rejects a non-boolean flag", () => {
    expect(UserDTOSchema.safeParse(user({ showVolunteerHours: 1 })).success).toBe(false)
  })
})

describe("NotificationTypeSchema — appended service-hours types", () => {
  it("parses both new values", () => {
    expect(NotificationTypeSchema.parse("cleanup_slot")).toBe("cleanup_slot")
    expect(NotificationTypeSchema.parse("hours_logged")).toBe("hours_logged")
  })

  it("appends them LAST, in this order (the backend mirror is byte-identical)", () => {
    const options = NotificationTypeSchema.options
    expect(options.at(-1)).toBe("event_broadcast")
    expect(options.at(-2)).toBe("hours_logged")
    expect(options.at(-3)).toBe("cleanup_slot")
    expect(options.at(-4)).toBe("post_mention")
  })

  it("keeps every pre-existing value and its position", () => {
    const options = NotificationTypeSchema.options
    expect(options.slice(0, -3)).toEqual([
      "report_update",
      "cleanup_chat",
      "cleanup_reminder",
      "cleanup_cancelled",
      "new_follower",
      "claim_available",
      "dm",
      "system",
      "report_chat",
      "group_chat",
      "cleanup_role",
      "post_like",
      "post_repost",
      "post_reply",
      "post_quote",
      "post_mention",
    ])
    expect(new Set(options).size).toBe(options.length)
  })

  it("still rejects an unknown type", () => {
    expect(NotificationTypeSchema.safeParse("hours_unlogged").success).toBe(false)
  })
})

describe("NotificationPrefsDTOSchema", () => {
  it("gains no bucket for the service-hours types — both ride cleanupChat", () => {
    expect(Object.keys(NotificationPrefsDTOSchema.shape)).toEqual([
      "push",
      "cleanupChat",
      "reportUpdates",
      "follows",
      "mentions",
      "postInteractions",
      "hostBroadcasts",
      "quietHours",
    ])
  })

  it("defaults hostBroadcasts to true so an older server's payload still parses", () => {
    const parsed = NotificationPrefsDTOSchema.parse({
      push: true,
      cleanupChat: true,
      reportUpdates: true,
      follows: true,
      mentions: true,
      postInteractions: true,
    })
    expect(parsed.hostBroadcasts).toBe(true)
  })
})
