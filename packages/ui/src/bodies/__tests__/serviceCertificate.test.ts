/**
 * The two-phase certificate card's pure state model. `now` is injected, so no fake timers here.
 */
import { describe, expect, it } from "vitest"
import { AppError, ErrorCode } from "@civfix/shared"
import {
  CERTIFICATE_EXPIRY_SOON_MS,
  certificateCardState,
  certificateErrorKey,
  certificateExpiryLabel,
} from "../serviceCertificate"

const NOW = Date.parse("2026-07-27T12:00:00.000Z")
const LIVE = new Date(NOW + 10 * 60 * 1000).toISOString()
const LAPSED = new Date(NOW - 1000).toISOString()

const base = {
  hasCertificate: false,
  isPending: false,
  isError: false,
  totalHours: 12,
  now: NOW,
}

describe("certificateCardState", () => {
  it("is disabled with no hours to certify, whatever else is true", () => {
    expect(certificateCardState({ ...base, totalHours: 0 })).toBe("disabled")
    expect(certificateCardState({ ...base, totalHours: 0, isError: true })).toBe("disabled")
    expect(certificateCardState({ ...base, totalHours: 0, isPending: true })).toBe("disabled")
  })

  it("is idle once there are hours and nothing has been issued", () => {
    expect(certificateCardState(base)).toBe("idle")
  })

  it("is preparing while the issue mutation is in flight, even over a previous error", () => {
    expect(certificateCardState({ ...base, isPending: true })).toBe("preparing")
    expect(certificateCardState({ ...base, isPending: true, isError: true })).toBe("preparing")
  })

  it("is error after a failed attempt", () => {
    expect(certificateCardState({ ...base, isError: true })).toBe("error")
  })

  it("is ready for a certificate with a live link", () => {
    expect(
      certificateCardState({ ...base, hasCertificate: true, urlExpiresAt: LIVE }),
    ).toBe("ready")
  })

  it("is expired when the link has lapsed, is missing, or cannot be parsed", () => {
    for (const urlExpiresAt of [LAPSED, null, undefined, "not-a-date"]) {
      expect(certificateCardState({ ...base, hasCertificate: true, urlExpiresAt })).toBe("expired")
    }
  })

  it("treats an expiry exactly at now as expired", () => {
    expect(
      certificateCardState({
        ...base,
        hasCertificate: true,
        urlExpiresAt: new Date(NOW).toISOString(),
      }),
    ).toBe("expired")
  })
})

describe("certificateErrorKey", () => {
  it("maps a rate limit to its own copy", () => {
    expect(certificateErrorKey(new AppError(ErrorCode.RATE_LIMITED, "slow down"))).toBe(
      "rate_limited",
    )
  })

  it("maps everything else, including a non-error, to generic", () => {
    expect(certificateErrorKey(new AppError(ErrorCode.INTERNAL, "boom"))).toBe("generic")
    expect(certificateErrorKey(new Error("network"))).toBe("generic")
    expect(certificateErrorKey(undefined)).toBe("generic")
  })

  it("recognises a cross-realm structurally-cloned AppError", () => {
    expect(certificateErrorKey({ name: "AppError", code: "RATE_LIMITED" })).toBe("rate_limited")
  })
})

describe("certificateExpiryLabel", () => {
  it("is ok while the link has time left", () => {
    expect(certificateExpiryLabel(LIVE, NOW)).toBe("ok")
  })

  it("is soon inside the last couple of minutes, at the boundary and past it", () => {
    const boundary = new Date(NOW + CERTIFICATE_EXPIRY_SOON_MS).toISOString()
    expect(certificateExpiryLabel(boundary, NOW)).toBe("soon")
    expect(certificateExpiryLabel(LAPSED, NOW)).toBe("soon")
  })

  it("is soon for an unparseable expiry", () => {
    expect(certificateExpiryLabel("nope", NOW)).toBe("soon")
  })
})
