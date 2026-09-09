import { describe, expect, it } from "vitest"
import { CheckinOutcomeSchema } from "@civfix/shared"
import {
  MANUAL_CODE_MAX,
  MANUAL_CODE_MIN,
  checkinResultRender,
  manualCodeReady,
  normalizeManualCode,
} from "../checkinResult"
import { formatTicketCode } from "../ticketModel"

describe("checkinResultRender", () => {
  it("covers every outcome the contract can send", () => {
    for (const outcome of CheckinOutcomeSchema.options) {
      const render = checkinResultRender(outcome, true)
      expect(render.titleKey, outcome).toMatch(/^result\./)
      expect(render.bodyKey, outcome).toMatch(/^result\./)
      expect(["success", "warning", "error", "neutral"]).toContain(render.tone)
    }
  })

  it("reads a FIRST check-in as success and a repeat scan as a warning", () => {
    expect(checkinResultRender("checked_in", true).tone).toBe("success")
    expect(checkinResultRender("checked_in", false).tone).toBe("warning")
    expect(checkinResultRender("checked_in", false).titleKey).toBe("result.already_title")
    expect(checkinResultRender("already", true).tone).toBe("warning")
  })

  it("treats a cancelled ticket, the wrong event and an unknown code as errors", () => {
    expect(checkinResultRender("cancelled", true).tone).toBe("error")
    expect(checkinResultRender("wrong_event", true).tone).toBe("error")
    expect(checkinResultRender("unknown_token", true).tone).toBe("error")
  })

  it("offers UNDO only where a seat was actually checked in", () => {
    expect(checkinResultRender("checked_in", true).undoable).toBe(true)
    expect(checkinResultRender("already", true).undoable).toBe(true)
    for (const outcome of ["cancelled", "wrong_event", "unknown_token", "waitlisted", "no_show"] as const) {
      expect(checkinResultRender(outcome, true).undoable, outcome).toBe(false)
    }
  })
})

describe("manual code entry", () => {
  it("MIRRORS the server's normalizer: strip whitespace AND hyphens, then uppercase", () => {
    expect(normalizeManualCode("  ab cd\tef  ")).toBe("ABCDEF")
    expect(normalizeManualCode("ABCD-EFGH-IJKL")).toBe("ABCDEFGHIJKL")
    expect(normalizeManualCode("abcd efgh-ijkl")).toBe("ABCDEFGHIJKL")
  })

  it("round-trips the printed ticket code back to the raw token", () => {
    const token = "K7Q2M4X9B3TF6HZP8RJ5WNCVDA"
    expect(normalizeManualCode(formatTicketCode(token))).toBe(token)
  })

  it("accepts only lengths the contract's ticket-token schema accepts", () => {
    expect(manualCodeReady("a".repeat(MANUAL_CODE_MIN - 1))).toBe(false)
    expect(manualCodeReady("a".repeat(MANUAL_CODE_MIN))).toBe(true)
    expect(manualCodeReady("a".repeat(MANUAL_CODE_MAX))).toBe(true)
    expect(manualCodeReady("a".repeat(MANUAL_CODE_MAX + 1))).toBe(false)
    expect(manualCodeReady("  " + "a".repeat(MANUAL_CODE_MIN) + "  ")).toBe(true)
  })
})

describe("formatTicketCode", () => {
  it("prints the WHOLE token, never a prefix", () => {
    const token = "K7Q2M4X9B3TF6HZP8RJ5WNCVDA"
    const printed = formatTicketCode(token)
    expect(printed.replace(/-/g, "")).toBe(token)
    expect(printed.replace(/-/g, "")).toHaveLength(token.length)
  })

  it("groups for legibility and uppercases", () => {
    expect(formatTicketCode("abcdefghij")).toBe("ABCD-EFGH-IJ")
    expect(formatTicketCode("")).toBe("")
  })
})
