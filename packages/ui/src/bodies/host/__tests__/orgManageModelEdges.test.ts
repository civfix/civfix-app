import { describe, expect, it } from "vitest"
import type { OrganizationMemberDTO } from "@civfix/shared"
import {
  counterVisible,
  lastAdminSeat,
  linksDraftFrom,
  linksErrors,
  linksPayload,
  orgLogoErrorKey,
  orgManageErrorKey,
  profileDirty,
  profileDraftFrom,
  profileErrors,
  profilePayload,
  socialLinksFromDraft,
} from "../orgManageModel"

const ID = "11111111-1111-4111-8111-111111111111"
const blankLinks = linksDraftFrom(null)

function member(role: OrganizationMemberDTO["role"], id: string): OrganizationMemberDTO {
  return { role, person: { id, name: id } } as OrganizationMemberDTO
}

describe("org link payloads", () => {
  it("sends null for every field of an empty links draft", () => {
    expect(linksPayload(ID, blankLinks)).toEqual({ id: ID, websiteUrl: null, donationUrl: null, socialLinks: null })
  })

  it("drops a handle that is only an @", () => {
    expect(socialLinksFromDraft({ ...blankLinks, instagram: " @ ", x: "@river" })).toEqual({ x: "river" })
  })

  it("trims the website and donation links", () => {
    expect(linksPayload(ID, { ...blankLinks, websiteUrl: "  https://a.org  " }).websiteUrl).toBe("https://a.org")
  })
})

describe("org profile payloads", () => {
  it("trims the name and nulls a whitespace description", () => {
    expect(profilePayload(ID, { name: "  River  ", description: "  ", logoMediaId: null })).toEqual({
      id: ID,
      name: "River",
      description: null,
      logoMediaId: null,
    })
  })

  it("carries the logo media id as given", () => {
    expect(profilePayload(ID, { name: "R", description: "", logoMediaId: "m1" }).logoMediaId).toBe("m1")
  })

  it("counts a logo change alone as dirty", () => {
    const initial = profileDraftFrom(null)
    expect(profileDirty({ ...initial, logoMediaId: "m1" }, initial)).toBe(true)
  })
})

describe("org form errors", () => {
  it("flags a whitespace-only name", () => {
    expect(profileErrors({ name: "   ", description: "", logoMediaId: null })).toEqual({ name: "manage.error_name" })
  })

  it("has no errors for a valid profile", () => {
    expect(profileErrors({ name: "River", description: "We clean.", logoMediaId: null })).toEqual({})
  })

  it("refuses a plain http link", () => {
    expect(linksErrors({ ...blankLinks, websiteUrl: "http://a.org" })).toEqual({ websiteUrl: "manage.error_https" })
  })

  it("has no errors for an empty links draft", () => {
    expect(linksErrors(blankLinks)).toEqual({})
  })
})

describe("org gating edges", () => {
  it("treats a single admin among members as the last admin seat", () => {
    expect(lastAdminSeat([member("admin", "a"), member("member", "b"), member("member", "c")])).toBe(true)
  })

  it("floors the counter threshold for a small maximum", () => {
    expect(counterVisible(3, 5)).toBe(false)
    expect(counterVisible(4, 5)).toBe(true)
  })
})

describe("org error key edges", () => {
  it("maps a rate limit on the logo upload to the shared rate-limit line", () => {
    expect(orgLogoErrorKey("RATE_LIMITED")).toBe("manage.error_rate_limited")
    expect(orgLogoErrorKey("VALIDATION")).toBe("manage.logo_error")
  })

  it("falls back for unauthorised and not-found", () => {
    expect(orgManageErrorKey("UNAUTHORIZED")).toBe("manage.error_generic")
    expect(orgManageErrorKey("NOT_FOUND")).toBe("manage.error_generic")
  })
})
