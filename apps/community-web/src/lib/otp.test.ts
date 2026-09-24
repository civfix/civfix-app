import { describe, it, expect } from "vitest"

import { applyOtpInput, emptyOtpCells, isOtpComplete, otpCode } from "@/lib/otp"

const LEN = 6

const cellsOf = (code: string): string[] => {
  const cells = emptyOtpCells(LEN)
  for (let i = 0; i < code.length && i < LEN; i += 1) cells[i] = code[i] === "_" ? "" : (code[i] as string)
  return cells
}

/**
 * isOtpComplete is the completion check behind the OTP auto-submit. The original bug was an extra
 * `!code.includes("")` guard, which is ALWAYS false (every string "includes" the empty string), so the
 * verify never fired when typing digit-by-digit. Completion is now "every cell is filled".
 */
describe("isOtpComplete / otpCode", () => {
  it("is complete only when every cell holds a digit", () => {
    expect(isOtpComplete(cellsOf("123456"))).toBe(true)
    expect(isOtpComplete(cellsOf("12345"))).toBe(false)
    expect(isOtpComplete(emptyOtpCells(LEN))).toBe(false)
  })

  it("treats a gap in the middle as incomplete even when five digits are present", () => {
    const gapped = cellsOf("123_56")
    expect(isOtpComplete(gapped)).toBe(false)
    expect(otpCode(gapped)).toBeNull()
  })

  it("builds the submit string only once complete", () => {
    expect(otpCode(cellsOf("123456"))).toBe("123456")
    expect(otpCode(cellsOf("12"))).toBeNull()
  })
})

/**
 * applyOtpInput drives every cell edit: single-digit typing, multi-digit paste, and the browser
 * autofilling the whole one-time code into the first cell. It must distribute multiple digits across
 * cells (not collapse them to the last one, the autofill bug) and keep each digit in the cell it was
 * typed into (not shift later digits left when a middle cell is cleared).
 */
describe("applyOtpInput", () => {
  it("sets a single digit and advances focus by one", () => {
    expect(applyOtpInput(emptyOtpCells(LEN), 0, "1")).toEqual({
      cells: cellsOf("1"),
      focusIndex: 1,
      complete: false,
    })
    expect(applyOtpInput(cellsOf("12"), 2, "3")).toEqual({
      cells: cellsOf("123"),
      focusIndex: 3,
      complete: false,
    })
  })

  it("keeps focus on the last cell when the final digit is typed, and reports complete", () => {
    const r = applyOtpInput(cellsOf("12345"), 5, "6")
    expect(otpCode(r.cells)).toBe("123456")
    expect(r.focusIndex).toBe(5)
    expect(r.complete).toBe(true)
  })

  it("strips non-digits from a single input", () => {
    expect(applyOtpInput(emptyOtpCells(LEN), 0, "a")).toEqual({
      cells: emptyOtpCells(LEN),
      focusIndex: 0,
      complete: false,
    })
  })

  it("distributes a full 6-digit autofill dropped into cell 0 (the autofill bug)", () => {
    const r = applyOtpInput(emptyOtpCells(LEN), 0, "987654")
    expect(otpCode(r.cells)).toBe("987654")
    expect(r.focusIndex).toBe(5)
    expect(r.complete).toBe(true)
  })

  it("distributes a partial paste into the cells starting at the edited one", () => {
    const r = applyOtpInput(emptyOtpCells(LEN), 2, "789")
    expect(r.cells).toEqual(["", "", "7", "8", "9", ""])
    expect(r.focusIndex).toBe(5)
    expect(r.complete).toBe(false)
  })

  it("ignores digits past the last cell when distributing", () => {
    const r = applyOtpInput(emptyOtpCells(LEN), 4, "789012")
    expect(r.cells).toEqual(["", "", "", "", "7", "8"])
    expect(r.focusIndex).toBe(5)
  })

  it("preserves earlier cells when distributing from a later index", () => {
    const r = applyOtpInput(cellsOf("1234"), 4, "56")
    expect(otpCode(r.cells)).toBe("123456")
    expect(r.focusIndex).toBe(5)
    expect(r.complete).toBe(true)
  })

  it("strips separators inside a pasted code", () => {
    const r = applyOtpInput(emptyOtpCells(LEN), 0, "12-34-56")
    expect(otpCode(r.cells)).toBe("123456")
    expect(r.complete).toBe(true)
  })

  it("clears only the edited cell, leaving later digits in place", () => {
    const r = applyOtpInput(cellsOf("123456"), 3, "")
    expect(r.cells).toEqual(["1", "2", "3", "", "5", "6"])
    expect(r.focusIndex).toBe(3)
    expect(r.complete).toBe(false)
  })

  it("refills a cleared middle cell in place without overwriting its neighbour", () => {
    const cleared = applyOtpInput(cellsOf("123456"), 3, "").cells
    const r = applyOtpInput(cleared, 3, "4")
    expect(otpCode(r.cells)).toBe("123456")
    expect(r.complete).toBe(true)
  })
})
