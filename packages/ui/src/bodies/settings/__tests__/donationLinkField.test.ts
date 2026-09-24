import { describe, expect, it } from "vitest"
import { HTTPS_URL_MAX_LENGTH, HttpsUrlSchema } from "@civfix/shared"
import {
  donationLinkDirty,
  donationLinkFieldError,
  normalizeDonationLink,
} from "../donationLinkField"

describe("the donation-link field rule", () => {
  it("treats blank as 'no link', which saves as null", () => {
    expect(normalizeDonationLink("   ")).toBeNull()
    expect(donationLinkFieldError("   ")).toBeNull()
  })

  it("accepts a full https link and trims it", () => {
    expect(normalizeDonationLink(" https://give.example.org/x ")).toBe("https://give.example.org/x")
    expect(donationLinkFieldError(" https://give.example.org/x ")).toBeNull()
  })

  it("flags anything that does not start with https:// or is not a safe link", () => {
    for (const raw of [
      "http://give.example.org",
      "give.example.org",
      "ftp://x",
      "https://",
      "https://10.0.0.1/x",
      "https://not a url",
    ]) {
      expect(donationLinkFieldError(raw), raw).toBe("invalid")
    }
  })

  it("is dirty only when the normalized value differs from what is saved", () => {
    expect(donationLinkDirty(" https://a.org ", "https://a.org")).toBe(false)
    expect(donationLinkDirty("", null)).toBe(false)
    expect(donationLinkDirty("", "https://a.org")).toBe(true)
    expect(donationLinkDirty("https://b.org", "https://a.org")).toBe(true)
  })

  it("caps the field at the contract's own maximum", () => {
    const base = "https://give.example.org/"
    const atMax = base + "a".repeat(HTTPS_URL_MAX_LENGTH - base.length)
    expect(HttpsUrlSchema.safeParse(atMax).success).toBe(true)
    expect(HttpsUrlSchema.safeParse(`${atMax}a`).success).toBe(false)
  })
})
