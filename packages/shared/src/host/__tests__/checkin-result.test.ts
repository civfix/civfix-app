import { describe, expect, it } from "vitest"
import { CheckinOutcomeSchema } from "../../schemas/host/checkin.js"
import { checkinResultRender } from "../checkin-result.js"

describe("checkinResultRender", () => {
  it("covers every outcome the contract can send", () => {
    for (const outcome of CheckinOutcomeSchema.options) {
      const render = checkinResultRender(outcome, true)
      expect(render.titleKey, outcome).toMatch(/^result\./)
      expect(render.bodyKey, outcome).toMatch(/^result\./)
      expect(["success", "warning", "error"]).toContain(render.tone)
      expect(render.shown, outcome).toBe(outcome)
    }
  })

  it("reads a FIRST check-in as success and a repeat scan as a warning", () => {
    expect(checkinResultRender("checked_in", true).tone).toBe("success")
    expect(checkinResultRender("checked_in", false).tone).toBe("warning")
    expect(checkinResultRender("checked_in", false).titleKey).toBe("result.already_title")
    expect(checkinResultRender("checked_in", false).shown).toBe("already")
    expect(checkinResultRender("already", true).tone).toBe("warning")
  })

  it("treats a cancelled ticket, the wrong event and an unknown code as errors", () => {
    expect(checkinResultRender("cancelled", true).tone).toBe("error")
    expect(checkinResultRender("wrong_event", true).tone).toBe("error")
    expect(checkinResultRender("unknown_token", true).tone).toBe("error")
  })

  it("reads a waitlisted or no-show ticket as a warning", () => {
    expect(checkinResultRender("waitlisted", true).tone).toBe("warning")
    expect(checkinResultRender("no_show", true).tone).toBe("warning")
  })

  it("offers UNDO only where a seat was actually checked in", () => {
    expect(checkinResultRender("checked_in", true).undoable).toBe(true)
    expect(checkinResultRender("already", true).undoable).toBe(true)
    for (const outcome of ["cancelled", "wrong_event", "unknown_token", "waitlisted", "no_show"] as const) {
      expect(checkinResultRender(outcome, true).undoable, outcome).toBe(false)
    }
  })
})
