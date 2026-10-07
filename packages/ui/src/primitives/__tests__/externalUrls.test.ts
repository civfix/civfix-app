import { describe, expect, it } from "vitest"
import {
  PRIVACY_URL,
  PROD_API_HOST,
  SOURCE_REPO_URL,
  TERMS_URL,
  WEB_ORIGIN,
  managePath,
  orgPagePath,
  offProductionApiHost,
  setApiHost,
  setSourceCommit,
  setWebOrigin,
  sourceCommit,
  sourceUrl,
  webOrigin,
} from "../externalUrls"

describe("the source link the AGPL asks every host to offer", () => {
  it("points at the repository root until a host states the deployed commit", () => {
    expect(sourceCommit()).toBe("")
    expect(sourceUrl()).toBe(SOURCE_REPO_URL)
  })

  it("links the exact deployed tree once the host sets a commit sha", () => {
    try {
      setSourceCommit("ABCDEF1234567890abcdef1234567890abcdef12")
      expect(sourceCommit()).toBe("abcdef1234567890abcdef1234567890abcdef12")
      expect(sourceUrl()).toBe(`${SOURCE_REPO_URL}/tree/abcdef1234567890abcdef1234567890abcdef12`)
      setSourceCommit("abc1234")
      expect(sourceUrl()).toBe(`${SOURCE_REPO_URL}/tree/abc1234`)
    } finally {
      setSourceCommit("")
    }
  })

  it("refuses anything that is not a commit sha, so a bad env value cannot forge the link", () => {
    for (const bad of ["", "main", "abc", "../../evil", "abc1234; rm -rf", "g".repeat(40)]) {
      setSourceCommit(bad)
      expect(sourceCommit(), bad).toBe("")
      expect(sourceUrl(), bad).toBe(SOURCE_REPO_URL)
    }
  })
})

describe("the configurable web origin", () => {
  it("defaults to production and follows the host's setter for post and manage links", () => {
    expect(webOrigin()).toBe(WEB_ORIGIN)
    try {
      setWebOrigin("https://civfix.dev/")
      expect(webOrigin()).toBe("https://civfix.dev")
      expect(TERMS_URL).toBe(`${WEB_ORIGIN}/legal/terms`)
    } finally {
      setWebOrigin(WEB_ORIGIN)
    }
    expect(webOrigin()).toBe(WEB_ORIGIN)
  })
})

describe("legal URLs", () => {
  it("derives every civfix-hosted legal URL from the one origin", () => {
    expect(TERMS_URL).toBe(`${WEB_ORIGIN}/legal/terms`)
    expect(PRIVACY_URL).toBe(`${WEB_ORIGIN}/legal/privacy`)
  })
})

describe("manage + org paths", () => {
  it("points the host console at /manage/events/:id", () => {
    expect(managePath("e1")).toBe("/manage/events/e1")
  })

  it("builds the public org page path", () => {
    expect(orgPagePath("river-keepers")).toBe("/orgs/river-keepers")
  })

  it("encodes the ids it is handed", () => {
    expect(managePath("a b")).toBe("/manage/events/a%20b")
    expect(orgPagePath("a/b")).toBe("/orgs/a%2Fb")
  })
})

describe("the resolved API host, so a beta plane switch is never invisible", () => {
  it("stays silent until a host states one, and stays silent on production", () => {
    try {
      expect(offProductionApiHost()).toBe("")
      setApiHost(`https://${PROD_API_HOST}`)
      expect(offProductionApiHost()).toBe("")
    } finally {
      setApiHost("")
    }
  })

  it("names the host whenever the build is talking to anything but production", () => {
    try {
      for (const url of ["https://api.civfix.dev", "https://API.CivFix.dev/", "api.civfix.dev"]) {
        setApiHost(url)
        expect(offProductionApiHost(), url).toBe("api.civfix.dev")
      }
      setApiHost("http://localhost:8080")
      expect(offProductionApiHost()).toBe("localhost:8080")
    } finally {
      setApiHost("")
    }
  })
})
