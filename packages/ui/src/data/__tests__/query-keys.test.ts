/**
 * Cache-key correctness for the CANONICAL key factory (the one both hosts now re-export).
 *
 * Two things are locked in here:
 *   1. `limit` / discriminator segments that change the SHAPE or SIZE of a cached result are part of the
 *      key, and every `*Root` prefix is an actual prefix of its variants (so one prefix invalidation
 *      reaches them all). These moved over from the web app's deleted local factory test.
 *   2. The jurisdiction key is fed ROUNDED coordinates (`roundJurisdictionCoord`), so a dragging pin or a
 *      jittering GPS fix collapses onto ONE cache entry instead of a fresh POST /map/resolve-jurisdiction
 *      per micro-movement.
 */
import { describe, expect, it } from "vitest"
import { queryKeys } from "../keys"
import { roundJurisdictionCoord } from "../hooks/reports"

/** True when `prefix` is a leading sub-array of `key` (how React Query matches a partial queryKey). */
function isPrefixOf(prefix: readonly unknown[], key: readonly unknown[]): boolean {
  if (prefix.length > key.length) return false
  return prefix.every((part, i) => Object.is(part, key[i]))
}

describe("queryKeys.myReports", () => {
  it("includes the limit so different page sizes get distinct cache entries", () => {
    expect(queryKeys.myReports(3)).toEqual(["reports", "mine", 3])
    expect(queryKeys.myReports(50)).toEqual(["reports", "mine", 50])
  })

  it("myReportsRoot is a prefix of every limit variant (for invalidation)", () => {
    expect(isPrefixOf(queryKeys.myReportsRoot, queryKeys.myReports(3))).toBe(true)
    expect(isPrefixOf(queryKeys.myReportsRoot, queryKeys.myReports(50))).toBe(true)
  })
})

describe("queryKeys.profileRoot", () => {
  it("is a prefix of every handle-keyed, uuid-keyed and viewer profile entry", () => {
    expect(isPrefixOf(queryKeys.profileRoot, queryKeys.profile("@ada"))).toBe(true)
    expect(isPrefixOf(queryKeys.profileRoot, queryKeys.profile("11111111-2222-3333-4444-555555555555"))).toBe(true)
    expect(isPrefixOf(queryKeys.profileRoot, queryKeys.myProfile)).toBe(true)
  })
})

describe("queryKeys.notifications", () => {
  it("includes the limit so distinct page sizes (20 vs 50) get distinct cache entries", () => {
    expect(queryKeys.notifications(20)).toEqual(["notifications", 20])
    expect(queryKeys.notifications(20)).not.toEqual(queryKeys.notifications(50))
  })

  it("notificationsRoot is a prefix of every limit variant (for invalidation)", () => {
    expect(isPrefixOf(queryKeys.notificationsRoot, queryKeys.notifications(20))).toBe(true)
    expect(isPrefixOf(queryKeys.notificationsRoot, queryKeys.notifications(50))).toBe(true)
  })

  it("a numeric-limit notifications key never collides with the prefs key", () => {
    expect(queryKeys.notifications(50)).not.toEqual(queryKeys.notificationPrefs)
    expect(typeof queryKeys.notificationPrefs[1]).toBe("string")
  })
})

describe("queryKeys.cleanups", () => {
  it("includes the limit so a sidebar preview never truncates the browse list", () => {
    expect(queryKeys.cleanups("upcoming", 50)).toEqual(["cleanups", "upcoming", 50])
    expect(queryKeys.cleanups("upcoming", 8)).not.toEqual(queryKeys.cleanups("upcoming", 50))
  })

  it("every list variant sits under the bare ['cleanups'] RSVP-patch prefix", () => {
    expect(isPrefixOf(["cleanups"], queryKeys.cleanups("upcoming", 50))).toBe(true)
    expect(isPrefixOf(["cleanups"], queryKeys.cleanupsNearby("upcoming", 20, 1.234, -5.678))).toBe(true)
  })
})

describe("queryKeys volunteer family", () => {
  it("includes the leaderboard limit so a 3-row preview never truncates the 50-row board", () => {
    expect(queryKeys.volunteerLeaderboard("0600001", 50)).toEqual([
      "volunteer",
      "leaderboard",
      "0600001",
      50,
    ])
    expect(queryKeys.volunteerLeaderboard("0600001", 3)).not.toEqual(
      queryKeys.volunteerLeaderboard("0600001", 50),
    )
  })

  it("volunteerLeaderboardAll is a prefix of every geoid + limit variant (for invalidation)", () => {
    expect(
      isPrefixOf(queryKeys.volunteerLeaderboardAll, queryKeys.volunteerLeaderboard("0600001", 50)),
    ).toBe(true)
    expect(
      isPrefixOf(queryKeys.volunteerLeaderboardAll, queryKeys.volunteerLeaderboard("1700002", 3)),
    ).toBe(true)
  })

  it("the itemised ledger sits UNDER the aggregate key, so one invalidation refreshes both", () => {
    // Total and rows are two projections of one ledger; they must never be able to disagree.
    expect(isPrefixOf(queryKeys.volunteerMe, queryKeys.volunteerEntries)).toBe(true)
    expect(queryKeys.volunteerEntries).not.toEqual(queryKeys.volunteerMe)
  })

  it("a credit invalidation over ['volunteer'] reaches every read surface in the family", () => {
    const volunteerPrefix = ["volunteer"] as const
    expect(isPrefixOf(volunteerPrefix, queryKeys.volunteerMe)).toBe(true)
    expect(isPrefixOf(volunteerPrefix, queryKeys.volunteerEntries)).toBe(true)
    expect(isPrefixOf(volunteerPrefix, queryKeys.volunteerUserEntries("u1"))).toBe(true)
    expect(isPrefixOf(volunteerPrefix, queryKeys.volunteerLeaderboard("0600001", 50))).toBe(true)
    expect(isPrefixOf(volunteerPrefix, queryKeys.eventHours("c1"))).toBe(true)
  })

  it("certificates are DELIBERATELY off the ['volunteer'] prefix", () => {
    // Each ServiceHoursCertificateDTO carries a presigned URL with a 15-minute TTL, and the web host's
    // React Query persister matches its safelist on queryKey[0] alone against a 24 h max age. A first
    // segment that is not on that safelist makes persisting a live capability URL structurally
    // impossible rather than a review item. Do not "tidy" this under the volunteer prefix.
    expect(isPrefixOf(["volunteer"], queryKeys.myCertificates)).toBe(false)
    expect(queryKeys.myCertificates[0]).toBe("certificates")
  })
})

describe("queryKeys.threads", () => {
  it("is a prefix of any nested inbox variant, so one invalidation covers the inbox", () => {
    expect(isPrefixOf(queryKeys.threads, ["threads", "inbox"])).toBe(true)
  })

  it("covers the unread-badge count, so badge and inbox refresh from one invalidation", () => {
    // Both hosts' map-home badge (the shared `useTotalUnread`) deliberately keeps its own single-page
    // count query instead of observing the INFINITE inbox (which would refetch every loaded page on each
    // realtime signal). That is only safe because its key is a CHILD of the prefix every ack / signal /
    // DM mutation invalidates. The badge's own derivation is covered in hooks/__tests__/chat-unread-badge.
    expect(isPrefixOf(queryKeys.threads, queryKeys.threadsUnread)).toBe(true)
    expect(queryKeys.threadsUnread).not.toEqual(queryKeys.threads)
  })
})

describe("queryKeys.mapReports", () => {
  it("keys on the region bbox AND the active categories", () => {
    const bbox = { west: -1, east: 1, south: -1, north: 1 }
    expect(queryKeys.mapReports(bbox, ["trash"])).toEqual(["map", "reports", bbox, ["trash"]])
    expect(queryKeys.mapReports(bbox, ["trash"])).not.toEqual(queryKeys.mapReports(bbox, []))
  })
})

describe("queryKeys.jurisdiction (rounded coords)", () => {
  const key = (lat: number, lng: number) =>
    queryKeys.jurisdiction(roundJurisdictionCoord(lat), roundJurisdictionCoord(lng))

  it("rounds to 5 decimals", () => {
    expect(roundJurisdictionCoord(37.7749295)).toBe(37.77493)
    expect(roundJurisdictionCoord(-122.4194155)).toBe(-122.41942)
  })

  it("collapses sub-meter pin jitter onto ONE cache entry", () => {
    expect(key(37.7749295, -122.4194155)).toEqual(key(37.77492951, -122.41941552))
  })

  it("still distinguishes points that are actually apart", () => {
    expect(key(37.7749, -122.4194)).not.toEqual(key(37.7859, -122.4194))
  })

  it("has its own namespace, so a map-pin invalidation never wipes it", () => {
    expect(isPrefixOf(["map", "reports"], key(37.7749, -122.4194))).toBe(false)
    expect(key(37.7749, -122.4194)[0]).toBe("jurisdiction")
  })
})

describe("family roots for prefix invalidation", () => {
  it("mapReportsRoot prefixes every map pin variant", () => {
    expect(queryKeys.mapReportsRoot).toEqual(["map", "reports"])
    expect(isPrefixOf(queryKeys.mapReportsRoot, queryKeys.mapReports({ w: 1 }, ["graffiti"]))).toBe(true)
    expect(isPrefixOf(queryKeys.mapReportsRoot, queryKeys.nearbyReportPins(1, 2))).toBe(true)
    expect(isPrefixOf(queryKeys.mapReportsRoot, queryKeys.nearbyReports(1, 2, 3))).toBe(true)
  })

  it("reportRoot, cleanupRoot and chatRoot prefix their detail, attendee and history keys", () => {
    expect(queryKeys.reportRoot).toEqual(["report"])
    expect(queryKeys.cleanupRoot).toEqual(["cleanup"])
    expect(queryKeys.chatRoot).toEqual(["chat"])
    expect(isPrefixOf(queryKeys.reportRoot, queryKeys.report("r1"))).toBe(true)
    expect(isPrefixOf(queryKeys.reportRoot, queryKeys.reportChatParticipants("r1"))).toBe(true)
    expect(isPrefixOf(queryKeys.cleanupRoot, queryKeys.cleanup("c1"))).toBe(true)
    expect(isPrefixOf(queryKeys.cleanupRoot, queryKeys.cleanupAttendees("c1"))).toBe(true)
    expect(isPrefixOf(queryKeys.cleanupRoot, queryKeys.eventIcs("c1"))).toBe(true)
    expect(isPrefixOf(queryKeys.chatRoot, queryKeys.chatHistory("room", "group"))).toBe(true)
  })
})
