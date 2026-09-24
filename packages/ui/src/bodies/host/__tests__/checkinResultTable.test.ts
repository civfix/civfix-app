import { describe, expect, it } from "vitest"
import { CheckinOutcomeSchema } from "@civfix/shared"
import { checkinResultRender, manualCodeReady, normalizeManualCode } from "../checkinResult"

const TABLE = {
  checked_in: ["success", "TicketCheck", "result.checked_in_title", "result.checked_in_body", true],
  already: ["warning", "UserCheck", "result.already_title", "result.already_body", true],
  waitlisted: ["warning", "Hourglass", "result.waitlisted_title", "result.waitlisted_body", false],
  cancelled: ["error", "Ban", "result.cancelled_title", "result.cancelled_body", false],
  no_show: ["warning", "TriangleAlert", "result.no_show_title", "result.no_show_body", false],
  wrong_event: ["error", "TriangleAlert", "result.wrong_event_title", "result.wrong_event_body", false],
  unknown_token: ["error", "TriangleAlert", "result.unknown_title", "result.unknown_body", false],
} as const

describe("checkinResultRender full table", () => {
  it("pins tone, icon, keys and undo for every outcome on a first scan", () => {
    expect(Object.keys(TABLE).sort()).toEqual([...CheckinOutcomeSchema.options].sort())
    for (const outcome of CheckinOutcomeSchema.options) {
      const [tone, icon, titleKey, bodyKey, undoable] = TABLE[outcome]
      expect(checkinResultRender(outcome, true), outcome).toEqual({ tone, icon, titleKey, bodyKey, undoable })
    }
  })

  it("renders a repeat scan identically for every outcome except checked_in, which reads as already", () => {
    for (const outcome of CheckinOutcomeSchema.options) {
      const expected = outcome === "checked_in" ? checkinResultRender("already", true) : checkinResultRender(outcome, true)
      expect(checkinResultRender(outcome, false), outcome).toEqual(expected)
    }
  })

  it("never uses the neutral tone", () => {
    for (const outcome of CheckinOutcomeSchema.options) {
      for (const firstTime of [true, false]) {
        expect(checkinResultRender(outcome, firstTime).tone).not.toBe("neutral")
      }
    }
  })
})

describe("normalizeManualCode edges", () => {
  it("strips runs of mixed hyphens and whitespace, including non-breaking spaces", () => {
    expect(normalizeManualCode("ab - cd\u00a0ef\n-gh")).toBe("ABCDEFGH")
  })

  it("keeps other punctuation", () => {
    expect(normalizeManualCode("ab_cd.ef")).toBe("AB_CD.EF")
  })

  it("does not count stripped separators toward the length", () => {
    expect(manualCodeReady("ab-cd-ef-g")).toBe(false)
    expect(manualCodeReady("ab-cd-ef-gh")).toBe(true)
  })
})
