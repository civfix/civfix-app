import { describe, it, expect } from "vitest"
import { AppError, ErrorCode } from "@civfix/shared"

import { baselineErrorOverrides, errorMessage, genericErrorMessage } from "@/lib/error-messages"

/**
 * errorMessage() is the shared router behind every surface's friendly error copy. After i18n it no longer
 * surfaces raw server message text (spec §6: errors map by code, not message): each surface passes
 * already-localized `overrides` / `fallback`, and the router only decides which to show. These lock in the
 * resolution order (override -> fallback), that toAppError normalization works on raw thrown values, and
 * that the `web-errors` baseline helpers translate the common codes via the `web-errors` catalog.
 *
 * `t` is faked to echo its key (prefixed) so assertions can see which catalog key was chosen.
 */
const t = (key: string) => `t:${key}`

describe("errorMessage", () => {
  it("uses a matching override over everything else", () => {
    const err = new AppError(ErrorCode.RATE_LIMITED, "raw server text")
    expect(errorMessage(err, { RATE_LIMITED: "Slow down." })).toBe("Slow down.")
  })

  it("falls back to the provided fallback when no override matches (no raw server text leaked)", () => {
    const err = new AppError(ErrorCode.CONFLICT, "Already exists.")
    expect(errorMessage(err, { VALIDATION: "Check your input." }, { fallback: "Nope." })).toBe("Nope.")
  })

  it("uses the built-in default fallback when none is provided", () => {
    const err = new AppError(ErrorCode.INTERNAL, "leak this")
    expect(errorMessage(err)).toBe("Something went wrong. Please try again.")
  })

  it("normalizes a raw (non-AppError) thrown value via toAppError without leaking its message", () => {
    expect(errorMessage(new Error("network down"), {}, { fallback: "Generic." })).toBe("Generic.")
    expect(errorMessage("weird")).toBe("Something went wrong. Please try again.")
  })

  it("treats an empty-string override as a real value (not a fallthrough)", () => {
    const err = new AppError(ErrorCode.VALIDATION, "server")
    expect(errorMessage(err, { VALIDATION: "" })).toBe("")
  })
})

describe("baselineErrorOverrides", () => {
  it("maps each common code to its localized web-errors:code.* string", () => {
    const o = baselineErrorOverrides(t)
    expect(o.VALIDATION).toBe("t:code.VALIDATION")
    expect(o.RATE_LIMITED).toBe("t:code.RATE_LIMITED")
    expect(o.TURNSTILE_FAILED).toBe("t:code.TURNSTILE_FAILED")
    expect(o.NOT_FOUND).toBe("t:code.NOT_FOUND")
  })

  it("composes with errorMessage so an unhandled common code resolves to a localized baseline", () => {
    const err = new AppError(ErrorCode.RATE_LIMITED, "raw")
    expect(errorMessage(err, baselineErrorOverrides(t), { fallback: genericErrorMessage(t) })).toBe(
      "t:code.RATE_LIMITED",
    )
  })
})

describe("genericErrorMessage", () => {
  it("returns the localized generic line", () => {
    expect(genericErrorMessage(t)).toBe("t:generic")
  })
})
