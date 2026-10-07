/**
 * Two things are LOCKED here on purpose: the order, and the fact that the default is `posts` on BOTH
 * profiles.
 */
import { describe, expect, it } from "vitest"
import {
  PROFILE_DEFAULT_TAB,
  PROFILE_TAB_ORDER,
  buildProfileTabsModel,
  type ProfileTabAvailability,
} from "../profileTabsModel"

const ALL: ProfileTabAvailability = { posts: true, events: true, hours: true, reports: true }
const PERSON: ProfileTabAvailability = { posts: true, events: true, hours: false, reports: false }

describe("the tab contract", () => {
  it("fixes the order and defaults to posts", () => {
    expect(PROFILE_TAB_ORDER).toEqual(["posts", "events", "hours", "reports"])
    expect(PROFILE_DEFAULT_TAB).toBe("posts")
  })
})

describe("buildProfileTabsModel", () => {
  it("emits the full order with the requested tab selected", () => {
    const model = buildProfileTabsModel("hours", ALL)
    expect(model.role).toBe("tablist")
    expect(model.tabs.map((t) => t.id)).toEqual(["posts", "events", "hours", "reports"])
    expect(model.tabs.every((t) => t.role === "tab")).toBe(true)
    expect(model.tabs.filter((t) => t.selected).map((t) => t.id)).toEqual(["hours"])
    expect(model.active).toBe("hours")
  })

  it("filters unavailable tabs without reordering the rest", () => {
    expect(buildProfileTabsModel("posts", PERSON).tabs.map((t) => t.id)).toEqual([
      "posts",
      "events",
    ])
    expect(
      buildProfileTabsModel("posts", { ...ALL, events: false }).tabs.map((t) => t.id),
    ).toEqual(["posts", "hours", "reports"])
  })

  it("falls back to the first available tab when the requested one is hidden", () => {
    const model = buildProfileTabsModel("reports", PERSON)
    expect(model.active).toBe("posts")
    expect(model.tabs.filter((t) => t.selected).map((t) => t.id)).toEqual(["posts"])
  })

  it("falls back to the first available tab even when posts itself is gone", () => {
    expect(
      buildProfileTabsModel("reports", { posts: false, events: true, hours: true, reports: false })
        .active,
    ).toBe("events")
  })

  it("falls back to posts, with no tabs, when nothing at all is available", () => {
    const model = buildProfileTabsModel("hours", {
      posts: false,
      events: false,
      hours: false,
      reports: false,
    })
    expect(model.tabs).toEqual([])
    expect(model.active).toBe(PROFILE_DEFAULT_TAB)
  })
})
