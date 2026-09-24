import { describe, it, expect } from "vitest"
import { AppError, ErrorCode } from "@civfix/shared"

import { errorMessage } from "@/lib/error-messages"

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
