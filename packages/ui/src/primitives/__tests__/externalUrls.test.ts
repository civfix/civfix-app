import { describe, expect, it } from "vitest"
import {
  DONATION_TERMS_URL,
  PRIVACY_URL,
  TERMS_URL,
  WEB_ORIGIN,
  donatePath,
  donateUrl,
  legalUrlFor,
  managePath,
  manageUrl,
  orgPagePath,
  signupPagePath,
} from "../externalUrls"

describe("legal URLs", () => {
  it("derives every civfix-hosted legal URL from the one origin", () => {
    expect(TERMS_URL).toBe(`${WEB_ORIGIN}/legal/terms`)
    expect(PRIVACY_URL).toBe(`${WEB_ORIGIN}/legal/privacy`)
    expect(DONATION_TERMS_URL).toBe(`${WEB_ORIGIN}/legal/donations`)
  })

  it("maps every legal document type to a URL, and an unknown one to the legal index", () => {
    for (const type of [
      "terms",
      "privacy",
      "cookies",
      "subprocessors",
      "donations",
      "org_donation_agreement",
      "donation_disclosure",
    ]) {
      expect(legalUrlFor(type), type).toMatch(/^https:\/\//)
    }
    expect(legalUrlFor("who-knows")).toBe(`${WEB_ORIGIN}/legal`)
  })
})

describe("donate", () => {
  it("is a RELATIVE path on web, so the checkout stays same-origin", () => {
    expect(donatePath("river-keepers")).toBe("/donate/river-keepers")
    expect(donatePath("river-keepers").startsWith("/")).toBe(true)
  })

  it("carries the event as a query param when the donation came from an event", () => {
    expect(donatePath("river-keepers", "e1")).toBe("/donate/river-keepers?event=e1")
  })

  it("is absolute for native, which opens it in a browser with the address bar visible", () => {
    expect(donateUrl("river-keepers")).toBe(`${WEB_ORIGIN}/donate/river-keepers`)
  })

  it("encodes a slug and an event id rather than pasting them into the URL raw", () => {
    expect(donatePath("a/b", "x y")).toBe("/donate/a%2Fb?event=x%20y")
  })
})

describe("manage + org + signup paths", () => {
  it("points the host console at /manage/events/:id", () => {
    expect(managePath("e1")).toBe("/manage/events/e1")
    expect(manageUrl("e1")).toBe(`${WEB_ORIGIN}/manage/events/e1`)
  })

  it("builds the public org and signup-page paths", () => {
    expect(orgPagePath("river-keepers")).toBe("/orgs/river-keepers")
    expect(signupPagePath("river-cleanup")).toBe("/e/river-cleanup")
  })

  it("encodes the ids it is handed", () => {
    expect(managePath("a b")).toBe("/manage/events/a%20b")
    expect(orgPagePath("a/b")).toBe("/orgs/a%2Fb")
  })
})
