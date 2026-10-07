import { describe, expect, it } from "vitest"
import { CheckinOutcomeSchema } from "@civfix/shared"
import { checkinResultRender, normalizeTicketCode } from "@civfix/shared/host"

const TABLE = {
  checked_in: ["success", "result.checked_in_title", "result.checked_in_body", true],
  already: ["warning", "result.already_title", "result.already_body", true],
  waitlisted: ["warning", "result.waitlisted_title", "result.waitlisted_body", false],
  cancelled: ["error", "result.cancelled_title", "result.cancelled_body", false],
  no_show: ["warning", "result.no_show_title", "result.no_show_body", false],
  wrong_event: ["error", "result.wrong_event_title", "result.wrong_event_body", false],
  unknown_token: ["error", "result.unknown_title", "result.unknown_body", false],
} as const

describe("checkinResultRender full table", () => {
  it("pins tone, keys and undo for every outcome on a first scan", () => {
    expect(Object.keys(TABLE).sort()).toEqual([...CheckinOutcomeSchema.options].sort())
    for (const outcome of CheckinOutcomeSchema.options) {
      const [tone, titleKey, bodyKey, undoable] = TABLE[outcome]
      expect(checkinResultRender(outcome, true), outcome).toEqual({ shown: outcome, tone, titleKey, bodyKey, undoable })
    }
  })

  it("renders a repeat scan identically for every outcome except checked_in, which reads as already", () => {
    for (const outcome of CheckinOutcomeSchema.options) {
      const expected = outcome === "checked_in" ? checkinResultRender("already", true) : checkinResultRender(outcome, true)
      expect(checkinResultRender(outcome, false), outcome).toEqual(expected)
    }
  })
})

describe("normalizeTicketCode edges", () => {
  it("strips runs of mixed hyphens and whitespace, including non-breaking spaces", () => {
    expect(normalizeTicketCode("ab - cd ef\n-gh")).toBe("ABCDEFGH")
  })

  it("keeps other punctuation", () => {
    expect(normalizeTicketCode("ab_cd.ef")).toBe("AB_CD.EF")
  })
})
