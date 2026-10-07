/**
 * The realtime channel turns a per-user signal frame into TanStack Query invalidations. This pins the
 * topic -> query-key mapping both hosts share (the contract between the backend's signal topics and the
 * client caches): `notifications` refreshes the bell, `threads` the inbox family, `reports` the viewer's
 * reports, and an unknown topic maps to no keys so an older client stays safe.
 */
import { describe, expect, it } from "vitest"

import { invalidationKeysForTopic } from "../signals"
import { queryKeys } from "../keys"

describe("invalidationKeysForTopic", () => {
  it("notifications -> notificationsRoot", () => {
    expect(invalidationKeysForTopic("notifications")).toEqual([queryKeys.notificationsRoot])
  })

  it("threads -> the ['threads'] prefix, which covers every inbox variant", () => {
    expect(invalidationKeysForTopic("threads")).toEqual([queryKeys.threads])
    // Prefix check: a nested inbox variant is still matched by the single key above.
    const prefix = queryKeys.threads
    expect(["threads", "inbox"].slice(0, prefix.length)).toEqual([...prefix])
  })

  it("reports -> myReportsRoot", () => {
    expect(invalidationKeysForTopic("reports")).toEqual([queryKeys.myReportsRoot])
  })

  it("feed and feed_counts are deliberate no-ops - the pill and the counts patcher own them", () => {
    expect(invalidationKeysForTopic("feed", undefined, "post-1")).toEqual([])
    expect(invalidationKeysForTopic("feed_counts", undefined, "post-1")).toEqual([])
  })

  it("an unknown topic yields no keys (never throws)", () => {
    // Cast through never: a future topic this client predates must be a safe no-op.
    expect(invalidationKeysForTopic("future_topic" as never)).toEqual([])
  })

  it("a host can append its own extra keys for a topic without forking the mapping", () => {
    const extra = { threads: [["host", "badge"]] } as const
    expect(invalidationKeysForTopic("threads", extra)).toEqual([queryKeys.threads, ["host", "badge"]])
    // Topics the host did not extend are untouched.
    expect(invalidationKeysForTopic("reports", extra)).toEqual([queryKeys.myReportsRoot])
  })
})
