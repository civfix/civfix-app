import { describe, expect, it } from "vitest"
import type { CleanupDTO } from "@civfix/shared"
import {
  buildComposerEventRef,
  resolveComposerEvent,
} from "../postComposerModel"
import {
  PROFILE_DEFAULT_TAB,
  PROFILE_TAB_ORDER,
  buildProfileTabsModel,
} from "../profileTabsModel"
import { SEARCH_RESULT_CARD_LAYOUT } from "../searchResultsModel"

const repostedEvent = {
  id: "event-riverwalk",
  title: "Riverwalk cleanup",
  eventKind: "cleanup",
  status: "upcoming",
  scheduledAt: "2026-08-02T16:00:00.000Z",
  lat: 34.04,
  lng: -118.25,
  going: 11,
  joined: false,
  organizer: { id: "organizer-2", name: "Dev Patel" },
} as CleanupDTO

describe("secondary portrait behavior models", () => {
  it("keeps a reposted event visible without relying on the attending-events query", () => {
    const snapshot = buildComposerEventRef(repostedEvent, "2026-07-21T19:00:00.000Z")

    expect(resolveComposerEvent(repostedEvent.id, snapshot, [])).toEqual(snapshot)
  })

  /**
   * A DELIBERATE REVERSAL, recorded rather than quietly dropped.
   *
   * This case used to assert the opposite: "keeps profile sections in reference order WITHOUT a
   * misleading Events and Posts selector". That was the right call at the time. Posts was then a short
   * trailing section under Impact, Events and Your Reports, and a two-way selector over Events and Posts
   * implied a symmetry between them that did not exist.
   *
   * P7 changes the premise, so the conclusion changes with it. The timeline is now the profile's PRIMARY
   * content, not its footer; the control is four PEER sections (Posts, Events, Hours, Reports) with a
   * default and an availability model; and it is the same control on the own profile and on someone
   * else's, where a bespoke Events/Posts segmented control already existed and defaulted to Events. The
   * selector is no longer misleading because the sections it selects between really are peers.
   */
  it("puts Posts first and selects it by default on every profile", () => {
    expect(PROFILE_TAB_ORDER[0]).toBe("posts")
    expect(PROFILE_DEFAULT_TAB).toBe("posts")

    const own = buildProfileTabsModel(PROFILE_DEFAULT_TAB, {
      posts: true,
      events: true,
      hours: true,
      reports: true,
    })
    expect(own.tabs.map((tab) => tab.id)).toEqual(["posts", "events", "hours", "reports"])
    expect(own.active).toBe("posts")
  })

  it("drops unavailable tabs without reordering the rest", () => {
    const person = buildProfileTabsModel("posts", {
      posts: true,
      events: true,
      hours: false,
      reports: false,
    })
    expect(person.tabs.map((tab) => tab.id)).toEqual(["posts", "events"])
  })

  it("falls back to the first available tab when the requested one is gone", () => {
    expect(
      buildProfileTabsModel("hours", {
        posts: true,
        events: true,
        hours: false,
        reports: false,
      }).active,
    ).toBe("posts")
  })

  it("defines individual search cards instead of a divided group surface", () => {
    expect(SEARCH_RESULT_CARD_LAYOUT).toMatchObject({
      gap: 9,
      radius: 18,
      individualCards: true,
      dividedContainer: false,
    })
  })
})
