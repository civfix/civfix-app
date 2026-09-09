import { describe, it, expect } from "vitest"

import { isOtpComplete, applyOtpInput } from "@/lib/otp"

const LEN = 6

/**
 * isOtpComplete is the completion check behind the OTP auto-submit. The original bug was an extra
 * `!code.includes("")` guard, which is ALWAYS false (every string "includes" the empty string), so the
 * verify never fired when typing digit-by-digit. The correct rule is purely length-based: `code` is the
 * gap-stripped joined string, so length === OTP_LENGTH already means all six cells are filled.
 */
describe("isOtpComplete", () => {
  it("is true only when the code has exactly `length` digits", () => {
    expect(isOtpComplete("123456", LEN)).toBe(true)
    expect(isOtpComplete("12345", LEN)).toBe(false)
    expect(isOtpComplete("", LEN)).toBe(false)
  })

  it("does not regress on the includes-empty-string trap", () => {
    // A complete code must read complete even though "123456".includes("") === true.
    expect("123456".includes("")).toBe(true)
    expect(isOtpComplete("123456", LEN)).toBe(true)
  })
})

/**
 * applyOtpInput drives every cell edit: single-digit typing, multi-digit paste, and the browser
 * autofilling the whole one-time code into the first cell. It must distribute multiple digits across
 * cells (not collapse them to the last one, the autofill bug) while keeping single-digit typing
 * identical to the old per-cell behavior.
 */
describe("applyOtpInput", () => {
  it("sets a single digit and advances focus by one", () => {
    expect(applyOtpInput("", 0, "1", LEN)).toEqual({
      code: "1",
      focusIndex: 1,
      complete: false,
    })
    expect(applyOtpInput("12", 2, "3", LEN)).toEqual({
      code: "123",
      focusIndex: 3,
      complete: false,
    })
  })

  it("keeps focus on the last cell when the final digit is typed, and reports complete", () => {
    const r = applyOtpInput("12345", 5, "6", LEN)
    expect(r.code).toBe("123456")
    expect(r.focusIndex).toBe(5)
    expect(r.complete).toBe(true)
  })

  it("strips non-digits from a single input", () => {
    expect(applyOtpInput("", 0, "a", LEN)).toEqual({
      code: "",
      focusIndex: 0,
      complete: false,
    })
  })

  it("distributes a full 6-digit autofill dropped into cell 0 (the autofill bug)", () => {
    const r = applyOtpInput("", 0, "987654", LEN)
    expect(r.code).toBe("987654")
    expect(r.focusIndex).toBe(5)
    expect(r.complete).toBe(true)
  })

  it("distributes a partial paste starting at the edited cell", () => {
    const r = applyOtpInput("", 2, "789", LEN)
    // Cells 2,3,4 get 7,8,9; next empty cell is 5.
    expect(r.code).toBe("789")
    expect(r.focusIndex).toBe(5)
    expect(r.complete).toBe(false)
  })

  it("ignores digits past the last cell when distributing", () => {
    // From index 4 only cells 4 and 5 exist, so just "78" lands; the rest is dropped. With the
    // earlier cells empty, the gap-stripped code is "78".
    const r = applyOtpInput("", 4, "789012", LEN)
    expect(r.code).toBe("78")
    expect(r.focusIndex).toBe(5)
  })

  it("preserves earlier cells when distributing from a later index", () => {
    // With cells 0-3 already filled, a 2-digit autofill at index 4 completes the code in place.
    const r = applyOtpInput("1234", 4, "56", LEN)
    expect(r.code).toBe("123456")
    expect(r.focusIndex).toBe(5)
    expect(r.complete).toBe(true)
  })

  it("strips separators inside a pasted code", () => {
    const r = applyOtpInput("", 0, "12-34-56", LEN)
    expect(r.code).toBe("123456")
    expect(r.complete).toBe(true)
  })

  it("clears the edited cell when the input becomes empty", () => {
    // cells become ["1","2","3","","5","6"]; the gap-stripped join drops the 4th digit.
    const r = applyOtpInput("123456", 3, "", LEN)
    expect(r.code).toBe("12356")
    expect(r.focusIndex).toBe(3)
    expect(r.complete).toBe(false)
  })
})
