/**
 * Muting a group from the conversation pill or the inbox row must also refresh GroupInfoBody's
 * Mute/Unmute row, so the hook owns the group-info refresh for every caller.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { muteInvalidationKeys } from "../reportChat"
import { queryKeys } from "../../keys"

describe("muteInvalidationKeys", () => {
  it("refreshes the inbox and the group's info for a group room", () => {
    expect(muteInvalidationKeys("group", "g1")).toEqual([queryKeys.threads, queryKeys.groupInfo("g1")])
  })

  it("refreshes only the inbox for cleanup and report rooms", () => {
    expect(muteInvalidationKeys("cleanup", "c1")).toEqual([queryKeys.threads])
    expect(muteInvalidationKeys("report", "r1")).toEqual([queryKeys.threads])
  })

  it("leaves GroupInfoBody without its own per-call invalidation", () => {
    const body = readFileSync(new URL("../../../bodies/GroupInfoBody.tsx", import.meta.url), "utf8")
    expect(body).not.toContain("onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.groupInfo(id) })")
  })
})
