import { describe, expect, it } from "vitest"

import { routeSegment } from "./route-segment"

describe("routeSegment", () => {
  it("reads and decodes the segment after the prefix, with or without a trailing slash", () => {
    expect(routeSegment("/orgs/acme/", "orgs")).toEqual({ kind: "raw", value: "acme" })
    expect(routeSegment("/orgs/acme", "orgs")).toEqual({ kind: "raw", value: "acme" })
    expect(routeSegment("/orgs/acme/manage/", "orgs")).toEqual({ kind: "raw", value: "acme" })
    expect(routeSegment("/service-record/CF%2DABC/", "service-record")).toEqual({ kind: "raw", value: "CF-ABC" })
  })

  it("treats a missing path, another prefix, a bare visit and the export placeholder as none", () => {
    expect(routeSegment(null, "e")).toEqual({ kind: "none" })
    expect(routeSegment(undefined, "e")).toEqual({ kind: "none" })
    expect(routeSegment("", "e")).toEqual({ kind: "none" })
    expect(routeSegment("/cleanups/abc/", "e")).toEqual({ kind: "none" })
    expect(routeSegment("/e/", "e")).toEqual({ kind: "none" })
    expect(routeSegment("/e/_/", "e")).toEqual({ kind: "none" })
  })

  it("reports a malformed escape as undecodable with the raw segment", () => {
    expect(routeSegment("/e/%zz/", "e")).toEqual({ kind: "undecodable", raw: "%zz" })
  })
})
