import { describe, expect, it } from "vitest"
import type { TFunction } from "i18next"
import { AppError, ErrorCode } from "@civfix/shared"
import { submitErrorMessage } from "../submitErrors"

const t = ((key: string) => key) as unknown as TFunction

const refused = (code: ErrorCode, fields?: Record<string, string>) =>
  new AppError(code, "refused", fields ? { fields } : undefined)

describe("submitErrorMessage", () => {
  it("names the text fields when a validation refusal points at one, nested keys included", () => {
    expect(submitErrorMessage(refused(ErrorCode.VALIDATION, { title: "x" }), t)).toBe("errors.validation_text")
    expect(submitErrorMessage(refused(ErrorCode.VALIDATION, { description: "x" }), t)).toBe("errors.validation_text")
    expect(submitErrorMessage(refused(ErrorCode.VALIDATION, { "addr.line": "x" }), t)).toBe("errors.validation_text")
  })

  it("names the media when the refusal points at the upload ids and no text field", () => {
    expect(submitErrorMessage(refused(ErrorCode.VALIDATION, { "mediaUploadIds.0": "x" }), t)).toBe(
      "errors.validation_media",
    )
    expect(
      submitErrorMessage(refused(ErrorCode.VALIDATION, { mediaUploadIds: "x", title: "y" }), t),
    ).toBe("errors.validation_text")
  })

  it("falls back to the plain validation copy, which an implausible GPS fix shares", () => {
    expect(submitErrorMessage(refused(ErrorCode.VALIDATION), t)).toBe("errors.validation")
    expect(submitErrorMessage(refused(ErrorCode.VALIDATION, { category: "x" }), t)).toBe("errors.validation")
    expect(submitErrorMessage(refused(ErrorCode.GPS_IMPLAUSIBLE), t)).toBe("errors.validation")
  })

  it("maps each remaining refusal to its own copy and everything else to the generic line", () => {
    expect(submitErrorMessage(refused(ErrorCode.RATE_LIMITED), t)).toBe("errors.rate_limited")
    expect(submitErrorMessage(refused(ErrorCode.TURNSTILE_FAILED), t)).toBe("errors.turnstile_failed")
    expect(submitErrorMessage(refused(ErrorCode.MEDIA_REJECTED), t)).toBe("errors.media_rejected")
    expect(submitErrorMessage(refused(ErrorCode.UNAUTHORIZED), t)).toBe("errors.unauthorized")
    expect(submitErrorMessage(refused(ErrorCode.FORBIDDEN), t)).toBe("errors.unauthorized")
    expect(submitErrorMessage(refused(ErrorCode.NOT_FOUND), t)).toBe("errors.generic")
    expect(submitErrorMessage(new Error("offline"), t)).toBe("errors.generic")
  })

  it("reads a cross-realm AppError clone by its name", () => {
    const clone = { name: "AppError", code: "RATE_LIMITED", message: "slow down" }
    expect(submitErrorMessage(clone, t)).toBe("errors.rate_limited")
  })
})
