import { describe, expect, it } from "vitest"
import type { AnnouncementDTO } from "@civfix/shared"
import { MAX_ANNOUNCEMENT_BODY } from "@civfix/shared"
import {
  ANNOUNCEMENT_PREVIEW_CHARS,
  AUDIENCE_ICONS,
  AUDIENCE_OPTIONS,
  announcementByline,
  announcementCounts,
  announcementErrorKey,
  announcementHeading,
  announcementPreview,
  announcementReady,
  announcementSentAt,
  audienceFor,
  audienceReady,
  bodyCounterVisible,
} from "../announcementModel"

const SENT = "2026-09-16T18:00:00.000Z"
const MADE = "2026-09-16T17:59:00.000Z"

function announcement(over: Partial<AnnouncementDTO> = {}): AnnouncementDTO {
  return {
    id: "a1",
    cleanupId: "c1",
    status: "sent",
    bodyMd: "Pizza is here.",
    createdAt: MADE,
    sentAt: SENT,
    ...over,
  }
}

describe("what the composer will let a host send", () => {
  it("wants a body, and nothing else", () => {
    expect(announcementReady("")).toBe(false)
    expect(announcementReady("   \n  ")).toBe(false)
    expect(announcementReady("Bring gloves")).toBe(true)
  })

  it("refuses a body past the contract's own ceiling rather than letting the server refuse it", () => {
    expect(announcementReady("x".repeat(MAX_ANNOUNCEMENT_BODY))).toBe(true)
    expect(announcementReady("x".repeat(MAX_ANNOUNCEMENT_BODY + 1))).toBe(false)
  })

  it("shows the counter only as the body nears the limit", () => {
    expect(bodyCounterVisible(0)).toBe(false)
    expect(bodyCounterVisible(Math.floor(MAX_ANNOUNCEMENT_BODY * 0.5))).toBe(false)
    expect(bodyCounterVisible(MAX_ANNOUNCEMENT_BODY)).toBe(true)
  })
})

describe("the audience the picker builds", () => {
  it("offers the five options the contract accepts, each with an icon", () => {
    expect([...AUDIENCE_OPTIONS]).toEqual([
      "all_registered",
      "checked_in",
      "not_checked_in",
      "waitlist",
      "slots",
    ])
    for (const kind of AUDIENCE_OPTIONS) expect(AUDIENCE_ICONS[kind], kind).toBeTruthy()
  })

  it("carries slot ids only on the slots option", () => {
    expect(audienceFor("all_registered", ["s1"])).toEqual({ kind: "all_registered" })
    expect(audienceFor("slots", ["s1", "s2"])).toEqual({ kind: "slots", ids: ["s1", "s2"] })
  })

  it("blocks a slots audience with nothing picked, because the schema demands at least one", () => {
    expect(audienceReady("slots", [])).toBe(false)
    expect(audienceReady("slots", ["s1"])).toBe(true)
    expect(audienceReady("waitlist", [])).toBe(true)
  })
})

describe("what a card shows", () => {
  it("uses the title when there is one and nothing when there is not", () => {
    expect(announcementHeading(announcement({ title: "Pizza" }))).toBe("Pizza")
    expect(announcementHeading(announcement({ title: "  " }))).toBeNull()
    expect(announcementHeading(announcement())).toBeNull()
  })

  it("flattens the markdown subset into one preview line", () => {
    expect(announcementPreview("## Heads up\n\n- Bring **gloves**\n- And water")).toBe(
      "Heads up Bring gloves And water",
    )
  })

  it("truncates a long body instead of letting the row grow", () => {
    const preview = announcementPreview("a".repeat(ANNOUNCEMENT_PREVIEW_CHARS + 50))
    expect(preview.length).toBeLessThanOrEqual(ANNOUNCEMENT_PREVIEW_CHARS + 1)
    expect(preview.endsWith("…")).toBe(true)
  })

  it("falls back to the created time when fan-out has not stamped a sent time yet", () => {
    expect(announcementSentAt(announcement())).toBe(SENT)
    expect(announcementSentAt(announcement({ sentAt: null }))).toBe(MADE)
  })
})

describe("delivery counts are the host projection, and their absence is the gate", () => {
  it("reads nothing off a public projection, so a reader is never told it was not for them", () => {
    expect(announcementCounts(announcement())).toBeNull()
  })

  it("reads the counts a host projection carries, defaulting the partial ones to zero", () => {
    expect(announcementCounts(announcement({ recipientCount: 42, sentCount: 40, failedCount: 2 })))
      .toEqual({ recipients: 42, sent: 40, failed: 2 })
    expect(announcementCounts(announcement({ recipientCount: 0 }))).toEqual({
      recipients: 0,
      sent: 0,
      failed: 0,
    })
  })
})

describe("error copy", () => {
  it("names the cap the host actually hit, and falls back once", () => {
    expect(announcementErrorKey("RATE_LIMITED")).toBe("announce.error_rate_limited")
    expect(announcementErrorKey("FORBIDDEN")).toBe("announce.error_forbidden")
    expect(announcementErrorKey("CONFLICT")).toBe("announce.error_conflict")
    expect(announcementErrorKey("VALIDATION")).toBe("announce.error_validation")
    expect(announcementErrorKey("ABUSE_HELD")).toBe("announce.error_held")
    expect(announcementErrorKey(undefined)).toBe("announce.error_generic")
    expect(announcementErrorKey("TEAPOT")).toBe("announce.error_generic")
  })
})

describe("who an announcement is signed by", () => {
  const person = {
    id: "u1",
    name: "Dana",
    avatarUrl: "https://example.test/dana.png",
    avatar: ["#111111", "#222222"],
  } as unknown as NonNullable<AnnouncementDTO["author"]>
  const org = {
    id: "o1",
    name: "Tidy Streets",
    logoUrl: "https://example.test/org.png",
  } as unknown as NonNullable<AnnouncementDTO["authorOrg"]>

  it("signs as the organization, with its logo and no personal gradient", () => {
    expect(announcementByline(announcement({ author: person, authorOrg: org }), "Host")).toEqual({
      name: "Tidy Streets",
      seed: "o1",
      photoUrl: "https://example.test/org.png",
      gradient: null,
    })
  })

  it("signs as the person when no organization posted it", () => {
    expect(announcementByline(announcement({ author: person }), "Host")).toEqual({
      name: "Dana",
      seed: "u1",
      photoUrl: "https://example.test/dana.png",
      gradient: ["#111111", "#222222"],
    })
  })

  it("falls back to the host label, seeded by the announcement itself", () => {
    expect(announcementByline(announcement(), "Host")).toEqual({
      name: "Host",
      seed: "a1",
      photoUrl: null,
      gradient: null,
    })
  })
})
