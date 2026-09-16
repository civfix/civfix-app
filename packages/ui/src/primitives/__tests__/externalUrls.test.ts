import { describe, expect, it } from "vitest"
import {
  PRIVACY_URL,
  TERMS_URL,
  WEB_ORIGIN,
  legalUrlFor,
  managePath,
  manageOrgSettingsPath,
  manageUrl,
  orgPagePath,
  setWebOrigin,
  signupPagePath,
  webOrigin,
} from "../externalUrls"

describe("the configurable web origin", () => {
  it("defaults to production and follows the host's setter for post and manage links", () => {
    expect(webOrigin()).toBe(WEB_ORIGIN)
    try {
      setWebOrigin("https://civfix.dev/")
      expect(webOrigin()).toBe("https://civfix.dev")
      expect(manageUrl("evt")).toBe("https://civfix.dev/manage/events/evt")
      expect(TERMS_URL).toBe(`${WEB_ORIGIN}/legal/terms`)
    } finally {
      setWebOrigin(WEB_ORIGIN)
    }
    expect(manageUrl("evt")).toBe(`${WEB_ORIGIN}/manage/events/evt`)
  })
})

describe("legal URLs", () => {
  it("derives every civfix-hosted legal URL from the one origin", () => {
    expect(TERMS_URL).toBe(`${WEB_ORIGIN}/legal/terms`)
    expect(PRIVACY_URL).toBe(`${WEB_ORIGIN}/legal/privacy`)
  })

  it("maps every legal document type to a URL, and an unknown one to the legal index", () => {
    for (const type of ["terms", "privacy", "cookies", "subprocessors"]) {
      expect(legalUrlFor(type), type).toMatch(/^https:\/\//)
    }
    expect(legalUrlFor("donations")).toBe(`${WEB_ORIGIN}/legal`)
    expect(legalUrlFor("who-knows")).toBe(`${WEB_ORIGIN}/legal`)
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

  it("points an organization's donation-link editing at its console settings", () => {
    expect(manageOrgSettingsPath("o1")).toBe("/manage/orgs/o1/settings")
  })

  it("encodes the ids it is handed", () => {
    expect(managePath("a b")).toBe("/manage/events/a%20b")
    expect(orgPagePath("a/b")).toBe("/orgs/a%2Fb")
    expect(manageOrgSettingsPath("a/b")).toBe("/manage/orgs/a%2Fb/settings")
  })
})
