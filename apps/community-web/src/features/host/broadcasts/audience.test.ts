import { describe, expect, it } from "vitest"

import {
  AUDIENCE_KINDS,
  EMPTY_AUDIENCE,
  audienceComplete,
  audienceExcludesGuests,
  audienceFrom,
  broadcastCan,
  channelsComplete,
  composerReadiness,
  composerReady,
  segmentFrom,
} from "./audience"

describe("broadcast audience", () => {
  it("maps every simple arm to its tagged segment", () => {
    for (const kind of AUDIENCE_KINDS) {
      if (kind === "ticket_types" || kind === "slots") continue
      expect(segmentFrom({ kind, ticketTypeIds: [], slotIds: [] })).toEqual({ kind })
    }
  })

  it("refuses an id-carrying arm with no ids, so a .min(1) schema is never hit", () => {
    expect(segmentFrom({ kind: "ticket_types", ticketTypeIds: [], slotIds: [] })).toBeNull()
    expect(segmentFrom({ kind: "slots", ticketTypeIds: [], slotIds: [] })).toBeNull()
    expect(audienceComplete({ kind: "slots", ticketTypeIds: [], slotIds: [] })).toBe(false)
  })

  it("round-trips a segment back into picker state", () => {
    expect(audienceFrom({ kind: "ticket_types", ids: ["t1", "t2"] })).toEqual({
      kind: "ticket_types",
      ticketTypeIds: ["t1", "t2"],
      slotIds: [],
    })
    expect(audienceFrom(null)).toEqual(EMPTY_AUDIENCE)
    expect(audienceFrom({ kind: "waitlist" })).toEqual({
      kind: "waitlist",
      ticketTypeIds: [],
      slotIds: [],
    })
  })

  it("knows a slots audience reaches members only", () => {
    expect(audienceExcludesGuests({ kind: "slots", ticketTypeIds: [], slotIds: ["s1"] })).toBe(true)
    expect(audienceExcludesGuests(EMPTY_AUDIENCE)).toBe(false)
  })

  it("requires between one and three channels", () => {
    expect(channelsComplete([])).toBe(false)
    expect(channelsComplete(["inapp"])).toBe(true)
    expect(channelsComplete(["inapp", "push", "email"])).toBe(true)
    expect(channelsComplete(["inapp", "push", "email", "sms"])).toBe(false)
  })

  it("reports readiness per field so the error summary can name what is missing", () => {
    const readiness = composerReadiness({
      subject: "",
      bodyMd: "hi",
      audience: EMPTY_AUDIENCE,
      channels: ["inapp"],
    })
    expect(readiness).toEqual({ subject: false, body: true, audience: true, channels: true })
    expect(composerReady(readiness)).toBe(false)
    expect(
      composerReady(
        composerReadiness({
          subject: "s",
          bodyMd: "b",
          audience: EMPTY_AUDIENCE,
          channels: ["inapp"],
        }),
      ),
    ).toBe(true)
  })

  it("rejects a subject or body past the contract limit", () => {
    const long = "x".repeat(161)
    expect(
      composerReadiness({
        subject: long,
        bodyMd: "b",
        audience: EMPTY_AUDIENCE,
        channels: ["inapp"],
      }).subject,
    ).toBe(false)
  })

  it("gates the state machine: only a draft is editable, only draft/scheduled can send", () => {
    expect(broadcastCan("draft")).toEqual({
      edit: true,
      send: true,
      schedule: true,
      cancel: false,
      delete: true,
    })
    expect(broadcastCan("scheduled").edit).toBe(false)
    expect(broadcastCan("scheduled").cancel).toBe(true)
    expect(broadcastCan("sending").send).toBe(false)
    expect(broadcastCan("sending").cancel).toBe(true)
    for (const terminal of ["sent", "cancelled", "failed"]) {
      expect(broadcastCan(terminal)).toEqual({
        edit: false,
        send: false,
        schedule: false,
        cancel: false,
        delete: false,
      })
    }
  })
})
