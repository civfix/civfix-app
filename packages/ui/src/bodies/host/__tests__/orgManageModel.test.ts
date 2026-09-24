import { describe, expect, it } from "vitest"
import type { OrganizationDTO, OrganizationMemberDTO } from "@civfix/shared"
import { MAX_ORG_DESCRIPTION, MAX_ORG_NAME } from "@civfix/shared"
import {
  SOCIAL_PREFIX,
  canOpenOrgManage,
  counterVisible,
  lastAdminSeat,
  linksDirty,
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

const ORG_ID = "11111111-1111-4111-8111-111111111111"

function org(over: Partial<OrganizationDTO> = {}): OrganizationDTO {
  return {
    id: ORG_ID,
    slug: "river-keepers",
    name: "River Keepers",
    description: "We clean the river.",
    websiteUrl: "https://riverkeepers.org",
    donationUrl: null,
    logoUrl: null,
    logoMediaId: null,
    socialLinks: { instagram: "riverkeepers" },
    verifiedStatus: "none",
    myRole: "owner",
    ...over,
  } as OrganizationDTO
}

function member(role: OrganizationMemberDTO["role"], id: string): OrganizationMemberDTO {
  return { role, person: { id, name: id } } as OrganizationMemberDTO
}

describe("the drafts start from the organization, not from an empty form", () => {
  it("reads the profile and the links the DTO already carries", () => {
    expect(profileDraftFrom(org())).toEqual({
      name: "River Keepers",
      description: "We clean the river.",
      logoMediaId: null,
    })
    expect(linksDraftFrom(org()).instagram).toBe("riverkeepers")
    expect(linksDraftFrom(org()).websiteUrl).toBe("https://riverkeepers.org")
  })

  it("reads an absent organization as an empty form rather than crashing", () => {
    expect(profileDraftFrom(null).name).toBe("")
    expect(linksDraftFrom(undefined).whatsapp).toBe("")
  })

  it("notices a change in any field, and only a real one", () => {
    const profile = profileDraftFrom(org())
    expect(profileDirty(profile, profile)).toBe(false)
    expect(profileDirty({ ...profile, name: "Riverkeepers" }, profile)).toBe(true)
    expect(profileDirty({ ...profile, logoMediaId: "m1" }, profile)).toBe(true)
    const links = linksDraftFrom(org())
    expect(linksDirty(links, links)).toBe(false)
    expect(linksDirty({ ...links, tiktok: "rk" }, links)).toBe(true)
  })
})

describe("each section PATCHes only its own fields", () => {
  it("sends the profile fields and never touches the links", () => {
    const payload = profilePayload(ORG_ID, { name: " River ", description: " ", logoMediaId: "m1" })
    expect(payload).toEqual({ id: ORG_ID, name: "River", description: null, logoMediaId: "m1" })
    expect("websiteUrl" in payload).toBe(false)
    expect("socialLinks" in payload).toBe(false)
  })

  it("sends the link fields and never touches the name", () => {
    const payload = linksPayload(ORG_ID, { ...linksDraftFrom(org()), donationUrl: "  " })
    expect(payload.donationUrl).toBeNull()
    expect(payload.websiteUrl).toBe("https://riverkeepers.org")
    expect("name" in payload).toBe(false)
  })

  it("clears a link by sending null, not by omitting it", () => {
    expect(linksPayload(ORG_ID, linksDraftFrom(null)).websiteUrl).toBeNull()
    expect(linksPayload(ORG_ID, linksDraftFrom(null)).socialLinks).toBeNull()
  })

  it("drops a pasted @ from a handle, the way the invite field does", () => {
    const links = { ...linksDraftFrom(null), instagram: "@riverkeepers" }
    expect(socialLinksFromDraft(links)).toEqual({ instagram: "riverkeepers" })
  })

  it("names a prefix for every platform, so no field asks for a whole URL", () => {
    expect(Object.keys(SOCIAL_PREFIX).sort()).toEqual(
      ["facebook", "instagram", "tiktok", "whatsapp", "x"],
    )
  })
})

describe("validation is the contract's own zod, never a second copy of the rules", () => {
  it("wants a name and refuses one past the contract's ceiling", () => {
    expect(profileErrors({ name: "", description: "", logoMediaId: null }).name).toBe(
      "manage.error_name",
    )
    expect(profileErrors({ name: "   ", description: "", logoMediaId: null }).name).toBeTruthy()
    expect(
      profileErrors({ name: "x".repeat(MAX_ORG_NAME + 1), description: "", logoMediaId: null }).name,
    ).toBeTruthy()
    expect(profileErrors({ name: "Ok", description: "", logoMediaId: null })).toEqual({})
  })

  it("refuses a description past the contract's ceiling", () => {
    const long = { name: "Ok", description: "x".repeat(MAX_ORG_DESCRIPTION + 1), logoMediaId: null }
    expect(profileErrors(long).description).toBe("manage.error_description")
  })

  it("demands https on both link fields, and lets an empty one through", () => {
    const base = linksDraftFrom(null)
    expect(linksErrors({ ...base, websiteUrl: "riverkeepers.org" }).websiteUrl).toBe(
      "manage.error_https",
    )
    expect(linksErrors({ ...base, donationUrl: "http://pay.example" }).donationUrl).toBe(
      "manage.error_https",
    )
    expect(linksErrors(base)).toEqual({})
    expect(linksErrors({ ...base, websiteUrl: "https://riverkeepers.org" })).toEqual({})
  })

  it("tells a bad handle from a bad phone number, because they are different fields", () => {
    const base = linksDraftFrom(null)
    expect(linksErrors({ ...base, instagram: "not a handle" })["socialLinks.instagram"]).toBe(
      "manage.error_handle",
    )
    expect(linksErrors({ ...base, whatsapp: "abc" })["socialLinks.whatsapp"]).toBe(
      "manage.error_whatsapp",
    )
    expect(linksErrors({ ...base, whatsapp: "15551234567" })).toEqual({})
  })
})

describe("gating", () => {
  it("opens for an owner and an admin, and for nobody else", () => {
    expect(canOpenOrgManage(org({ myRole: "owner" }))).toBe(true)
    expect(canOpenOrgManage(org({ myRole: "admin" }))).toBe(true)
    expect(canOpenOrgManage(org({ myRole: "member" }))).toBe(false)
    expect(canOpenOrgManage(org({ myRole: null }))).toBe(false)
    expect(canOpenOrgManage(null)).toBe(false)
  })

  it("spots the last admin seat so the client can pre-disable the move that empties it", () => {
    expect(lastAdminSeat([member("owner", "a"), member("member", "b")])).toBe(true)
    expect(lastAdminSeat([member("owner", "a"), member("admin", "b")])).toBe(false)
    expect(lastAdminSeat([])).toBe(true)
  })

  it("shows the counter only as a field nears its limit", () => {
    expect(counterVisible(0, 100)).toBe(false)
    expect(counterVisible(89, 100)).toBe(false)
    expect(counterVisible(90, 100)).toBe(true)
  })
})

describe("error copy", () => {
  it("names the last-admin refusal the way the server sends it: VALIDATION on userId", () => {
    expect(orgManageErrorKey("VALIDATION", { userId: "ORG_LAST_ADMIN" })).toBe(
      "manage.error_last_admin",
    )
  })

  it("does not read an unrelated CONFLICT, such as a taken handle, as the last-admin refusal", () => {
    expect(orgManageErrorKey("CONFLICT")).toBe("manage.error_generic")
    expect(orgManageErrorKey("VALIDATION", { name: "too long" })).toBe("manage.error_validation")
  })

  it("falls back once for everything else", () => {
    expect(orgManageErrorKey("FORBIDDEN")).toBe("manage.error_forbidden")
    expect(orgManageErrorKey("VALIDATION")).toBe("manage.error_validation")
    expect(orgManageErrorKey("RATE_LIMITED")).toBe("manage.error_rate_limited")
    expect(orgManageErrorKey(undefined)).toBe("manage.error_generic")
  })

  it("tells a rejected image from a failed upload", () => {
    expect(orgLogoErrorKey("MEDIA_REJECTED")).toBe("manage.logo_rejected")
    expect(orgLogoErrorKey(undefined)).toBe("manage.logo_error")
  })
})
