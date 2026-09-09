import { describe, expect, it } from "vitest"

import {
  donateCompletePath,
  donateFormPath,
  parseCompleteParams,
  parseDonateRoute,
  parseEventParam,
  statusTokenStorageKey,
} from "./donate-route"

describe("parseDonateRoute", () => {
  it("reads the org slug from the form path", () => {
    expect(parseDonateRoute("/donate/reach-out-la/")).toEqual({
      kind: "form",
      slug: "reach-out-la",
    })
    expect(parseDonateRoute("/donate/reach-out-la")).toEqual({
      kind: "form",
      slug: "reach-out-la",
    })
  })

  it("reads the complete view", () => {
    expect(parseDonateRoute("/donate/reach-out-la/complete/")).toEqual({
      kind: "complete",
      slug: "reach-out-la",
    })
  })

  it("treats the static-export placeholder as unaddressed", () => {
    expect(parseDonateRoute("/donate/_/")).toEqual({ kind: "missing" })
    expect(parseDonateRoute("/donate/")).toEqual({ kind: "missing" })
    expect(parseDonateRoute(null)).toEqual({ kind: "missing" })
    expect(parseDonateRoute("/legal/terms/")).toEqual({ kind: "missing" })
  })

  it("lowercases and decodes, and rejects a slug that cannot be one", () => {
    expect(parseDonateRoute("/donate/Reach-Out-LA/")).toEqual({
      kind: "form",
      slug: "reach-out-la",
    })
    expect(parseDonateRoute("/donate/not a slug/")).toEqual({
      kind: "invalid",
      raw: "not a slug",
    })
    expect(parseDonateRoute("/donate/%zz/")).toEqual({ kind: "invalid", raw: "%zz" })
  })

  it("rejects an unknown tail rather than silently donating", () => {
    expect(parseDonateRoute("/donate/reach-out-la/refund/")).toEqual({
      kind: "invalid",
      raw: "reach-out-la",
    })
  })
})

describe("parseCompleteParams", () => {
  it("reads the donation id, status token and session id", () => {
    expect(parseCompleteParams("?session_id=cs_1&donation=d1&t=tok")).toEqual({
      donationId: "d1",
      statusToken: "tok",
      sessionId: "cs_1",
    })
  })

  it("drops an unsubstituted Stripe template placeholder", () => {
    expect(parseCompleteParams("?session_id={CHECKOUT_SESSION_ID}&donation=d1").sessionId).toBe(null)
  })

  it("is empty for a bare visit", () => {
    expect(parseCompleteParams("")).toEqual({
      donationId: null,
      statusToken: null,
      sessionId: null,
    })
  })
})

describe("paths and keys", () => {
  it("builds trailing-slash paths that match the export layout", () => {
    expect(donateFormPath("reach-out-la")).toBe("/donate/reach-out-la/")
    expect(donateCompletePath("reach-out-la")).toBe("/donate/reach-out-la/complete/")
  })

  it("scopes the sessionStorage key per donation", () => {
    expect(statusTokenStorageKey("d1")).toBe("civfix.donate.status.d1")
    expect(statusTokenStorageKey("d2")).not.toBe(statusTokenStorageKey("d1"))
  })

  it("reads the optional event id", () => {
    expect(parseEventParam("?event=evt_1")).toBe("evt_1")
    expect(parseEventParam("?event=")).toBe(null)
    expect(parseEventParam("")).toBe(null)
  })
})
