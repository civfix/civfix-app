import { describe, it, expect } from "vitest"

import {
  serviceRecordCodeFromPath,
  serviceRecordPath,
} from "@/features/service-record/service-record-code"

/**
 * The public /service-record page reads its code from `window.location.pathname` rather than from
 * `usePathname()`, because the Cloudflare rewrite serves the static-export PLACEHOLDER document while
 * the browser's address bar keeps the real deep link. That parsing is the page's one piece of real
 * logic, and the web suite has no jsdom, so it lives in a pure module and is pinned here.
 */
describe("serviceRecordCodeFromPath", () => {
  it("reads the printed code off a deep link, with or without a trailing slash", () => {
    expect(serviceRecordCodeFromPath("/service-record/CFX-A1B2-C3D4-E5F6/")).toEqual({
      kind: "code",
      code: "A1B2C3D4E5F6",
    })
    expect(serviceRecordCodeFromPath("/service-record/A1B2C3D4E5F6")).toEqual({
      kind: "code",
      code: "A1B2C3D4E5F6",
    })
  })

  it("canonicalizes a hand-typed code: lowercase, and the Crockford I/L/O/U confusions", () => {
    expect(serviceRecordCodeFromPath("/service-record/cfx-a1b2-c3d4-e5f6/")).toEqual({
      kind: "code",
      code: "A1B2C3D4E5F6",
    })
    // I and L are typed for 1, O for 0, U for V - the alphabet omits them precisely so paper survives.
    expect(serviceRecordCodeFromPath("/service-record/ILOU12345678/")).toEqual({
      kind: "code",
      code: "110V12345678",
    })
  })

  it("decodes a percent-encoded segment (a printed code pasted from a mail client)", () => {
    expect(serviceRecordCodeFromPath("/service-record/CFX%2DA1B2%2DC3D4%2DE5F6/")).toEqual({
      kind: "code",
      code: "A1B2C3D4E5F6",
    })
  })

  it("treats the static-export placeholder document as NO code, not as a bad one", () => {
    // The SPA fallback serves out/service-record/_/index.html; a cold visit to the bare route also
    // lands here. Both must show the "enter a code" form rather than a scary error.
    expect(serviceRecordCodeFromPath("/service-record/_/")).toEqual({ kind: "none" })
    expect(serviceRecordCodeFromPath("/service-record/_")).toEqual({ kind: "none" })
    expect(serviceRecordCodeFromPath("/service-record/")).toEqual({ kind: "none" })
    expect(serviceRecordCodeFromPath("/service-record")).toEqual({ kind: "none" })
  })

  it("returns none for a foreign path or no path at all (SSR / prerender has no location)", () => {
    expect(serviceRecordCodeFromPath("/")).toEqual({ kind: "none" })
    expect(serviceRecordCodeFromPath("/leaderboard/0644000/")).toEqual({ kind: "none" })
    expect(serviceRecordCodeFromPath("")).toEqual({ kind: "none" })
    expect(serviceRecordCodeFromPath(null)).toEqual({ kind: "none" })
    expect(serviceRecordCodeFromPath(undefined)).toEqual({ kind: "none" })
  })

  it("reports a present-but-unusable segment as invalid so the page can say so without a round trip", () => {
    expect(serviceRecordCodeFromPath("/service-record/nope/")).toEqual({
      kind: "invalid",
      raw: "nope",
    })
    // Too short / too long are equally unusable.
    expect(serviceRecordCodeFromPath("/service-record/A1B2C3D4E5F/")).toEqual({
      kind: "invalid",
      raw: "A1B2C3D4E5F",
    })
  })

  it("does not throw on a malformed percent escape (decodeURIComponent raises URIError)", () => {
    expect(serviceRecordCodeFromPath("/service-record/%zz/")).toEqual({
      kind: "invalid",
      raw: "%zz",
    })
  })
})

describe("serviceRecordPath", () => {
  it("builds the trailing-slash permalink the static export and the _redirects rule expect", () => {
    expect(serviceRecordPath("A1B2C3D4E5F6")).toBe("/service-record/A1B2C3D4E5F6/")
  })

  it("round-trips through the parser", () => {
    expect(serviceRecordCodeFromPath(serviceRecordPath("A1B2C3D4E5F6"))).toEqual({
      kind: "code",
      code: "A1B2C3D4E5F6",
    })
  })
})
