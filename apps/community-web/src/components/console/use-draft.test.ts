import { describe, expect, it } from "vitest"

import { consoleDraftKey, consoleDraftOwner } from "./use-draft"

const VIEWER = "9f1c0f6e-9d2a-4a7f-8f2c-6f0f2d3a1b44"

describe("console draft keys", () => {
  it("reads back the owner the key was minted for, not the version segment", () => {
    const key = consoleDraftKey("ticket.evt_1", "tt_1", VIEWER)
    expect(consoleDraftOwner(key)).toBe(VIEWER)
    expect(consoleDraftOwner(key)).not.toBe("v1")
  })

  it("survives a scope that contains dots", () => {
    expect(consoleDraftOwner(consoleDraftKey("broadcast.evt_1", "new", VIEWER))).toBe(VIEWER)
  })

  it("gives two viewers two owners for the same scope", () => {
    const mine = consoleDraftKey("ticket.evt_1", "tt_1", VIEWER)
    const theirs = consoleDraftKey("ticket.evt_1", "tt_1", "other-viewer")
    expect(mine).not.toBe(theirs)
    expect(consoleDraftOwner(mine)).not.toBe(consoleDraftOwner(theirs))
  })

  it("falls back to anon for a signed-out key and for a foreign key", () => {
    expect(consoleDraftOwner(consoleDraftKey("ticket.evt_1", null))).toBe("anon")
    expect(consoleDraftOwner("some.other.localstorage.key")).toBe("anon")
    expect(consoleDraftOwner("")).toBe("anon")
  })

  it("keeps the id segment out of the owner", () => {
    expect(consoleDraftOwner(consoleDraftKey("ticket", "tt_1", VIEWER))).toBe(VIEWER)
  })
})
