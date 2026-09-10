import { beforeEach, describe, expect, it } from "vitest"
import { useNavStore } from "../useNavStore"
import {
  entryFromPath,
  pathForEntry,
  seedFor,
  searchModeFor,
  titleForEntry,
  titleParamsForEntry,
  viewForEntry,
  parentViewForEntry,
  pathForView,
  viewFromPath,
} from "../routes"
import type { DetailEntry, View } from "../types"

function resetStore(mode: "compact" | "expanded" = "compact"): void {
  useNavStore.setState({
    view: "home",
    stack: [],
    active: null,
    snap: 0,
    snapAnimated: true,
    query: "",
    mode,
    originView: null,
    seededDetailPage: false,
  })
}

function resetPristine(mode: "compact" | "expanded" = "compact"): void {
  useNavStore.setState({
    view: "map",
    stack: [],
    active: null,
    snap: 0,
    snapAnimated: true,
    query: "",
    mode,
    originView: null,
    seededDetailPage: false,
  })
}

function countNotifications(run: () => void): number {
  let calls = 0
  const unsub = useNavStore.subscribe(() => {
    calls += 1
  })
  run()
  unsub()
  return calls
}

beforeEach(() => resetStore())

describe("route round-trip (entryFromPath . pathForEntry)", () => {
  const cases: Array<[string, DetailEntry]> = [
    ["pin", { kind: "pin", id: "p1" }],
    ["cleanups (list)", { kind: "cleanups" }],
    ["cleanup (detail)", { kind: "cleanup", id: "c1" }],
    ["edit-cleanup", { kind: "edit-cleanup", id: "c1" }],
    ["create-cleanup", { kind: "create-cleanup" }],
    ["people", { kind: "people" }],
    ["person", { kind: "person", id: "u1" }],
    ["followers", { kind: "followers", id: "u1" }],
    ["following", { kind: "following", id: "u1" }],
    ["messages", { kind: "messages" }],
    ["thread (cleanup room)", { kind: "thread", id: "room1", roomKind: "cleanup" }],
    ["thread (dm room)", { kind: "thread", id: "dm1", roomKind: "dm" }],
    ["thread (report room)", { kind: "thread", id: "r1", roomKind: "report" }],
    ["thread (group room)", { kind: "thread", id: "grp1", roomKind: "group" }],
    ["pinned-messages (cleanup room)", { kind: "pinned-messages", id: "room1", roomKind: "cleanup" }],
    ["pinned-messages (dm room)", { kind: "pinned-messages", id: "dm1", roomKind: "dm" }],
    ["pinned-messages (report room)", { kind: "pinned-messages", id: "rep1", roomKind: "report" }],
    ["pinned-messages (group room)", { kind: "pinned-messages", id: "grp1", roomKind: "group" }],
    ["members (cleanup room)", { kind: "members", id: "room1", roomKind: "cleanup" }],
    ["members (group room)", { kind: "members", id: "grp1", roomKind: "group" }],
    ["new-group", { kind: "new-group" }],
    ["new-channel", { kind: "new-channel" }],
    ["group-info", { kind: "group-info", id: "grp1" }],
    ["myreports", { kind: "myreports" }],
    ["activity", { kind: "activity" }],
    ["notification-prefs", { kind: "notification-prefs" }],
    ["profile", { kind: "profile" }],
    ["settings (hub)", { kind: "settings" }],
    ["settings-account", { kind: "settings-account" }],
    ["settings-privacy", { kind: "settings-privacy" }],
    ["blocked", { kind: "blocked" }],
    ["language-settings", { kind: "language-settings" }],
    ["appearance-settings", { kind: "appearance-settings" }],
    ["report (view)", { kind: "view", view: "report" }],
    ["post", { kind: "post", id: "post-1" }],
    ["post-thread", { kind: "post-thread", id: "post-1" }],
    ["composer", { kind: "composer" }],
    ["quote composer", { kind: "composer", composerMode: "quote", targetPostId: "post-1" }],
    ["saves", { kind: "saves" }],
  ]

  it.each(cases)("round-trips %s", (_label, entry) => {
    const path = pathForEntry(entry)
    expect(entryFromPath(path)).toEqual(entry)
  })

  it("distinguishes the dm discriminator in the URL", () => {
    expect(pathForEntry({ kind: "thread", id: "x", roomKind: "dm" })).toBe("/messages/dm/x")
    expect(pathForEntry({ kind: "thread", id: "x", roomKind: "cleanup" })).toBe("/messages/x")
    expect(entryFromPath("/messages/dm/x")).toEqual({ kind: "thread", id: "x", roomKind: "dm" })
    expect(entryFromPath("/messages/x")).toEqual({ kind: "thread", id: "x", roomKind: "cleanup" })
  })

  it("distinguishes the report-room discriminator in the URL", () => {
    expect(pathForEntry({ kind: "thread", id: "x", roomKind: "report" })).toBe("/messages/report/x")
    expect(entryFromPath("/messages/report/x")).toEqual({ kind: "thread", id: "x", roomKind: "report" })
  })

  it("distinguishes the group discriminator in the URL (P4)", () => {
    expect(pathForEntry({ kind: "thread", id: "x", roomKind: "group" })).toBe("/messages/group/x")
    expect(entryFromPath("/messages/group/x")).toEqual({ kind: "thread", id: "x", roomKind: "group" })
    expect(pathForEntry({ kind: "thread", id: "x", roomKind: "group", title: "Crew" })).toBe("/messages/group/x")
  })

  it("new-group maps to /groups/new; other /groups children resolve to nothing", () => {
    expect(pathForEntry({ kind: "new-group" })).toBe("/groups/new")
    expect(entryFromPath("/groups/new")).toEqual({ kind: "new-group" })
    expect(entryFromPath("/groups")).toBeNull()
    expect(entryFromPath("/groups/abc123")).toBeNull()
  })

  it("new-channel maps to /channels/new; other /channels children resolve to nothing (P5 Task 5.3)", () => {
    expect(pathForEntry({ kind: "new-channel" })).toBe("/channels/new")
    expect(entryFromPath("/channels/new")).toEqual({ kind: "new-channel" })
    expect(entryFromPath("/channels")).toBeNull()
    expect(entryFromPath("/channels/abc123")).toBeNull()
  })

  it("group-info uses /groups/<id>/info without colliding with /groups/new (P4 Task 4.8)", () => {
    expect(pathForEntry({ kind: "group-info", id: "g1" })).toBe("/groups/g1/info")
    expect(entryFromPath("/groups/g1/info")).toEqual({ kind: "group-info", id: "g1" })
    expect(entryFromPath("/groups/new")).toEqual({ kind: "new-group" })
    expect(entryFromPath("/groups/new/info")).toEqual({ kind: "new-group" })
    expect(entryFromPath("/groups/g1")).toBeNull()
    expect(pathForEntry({ kind: "group-info" })).toBe("/messages")
  })

  it("pinned-messages uses the /messages/pins/<roomKind>/<id> form (no collision with the thread forms)", () => {
    expect(pathForEntry({ kind: "pinned-messages", id: "x", roomKind: "cleanup" })).toBe("/messages/pins/cleanup/x")
    expect(pathForEntry({ kind: "pinned-messages", id: "x", roomKind: "dm" })).toBe("/messages/pins/dm/x")
    expect(pathForEntry({ kind: "pinned-messages", id: "x", roomKind: "report" })).toBe("/messages/pins/report/x")
    expect(entryFromPath("/messages/pins/report/x")).toEqual({ kind: "pinned-messages", id: "x", roomKind: "report" })
    expect(entryFromPath("/messages/pins/bogus/x")).toEqual({ kind: "messages" })
    expect(entryFromPath("/messages/pins/dm")).toEqual({ kind: "messages" })
    expect(entryFromPath("/messages/pins")).toEqual({ kind: "messages" })
    expect(entryFromPath("/messages/pins-room-id")).toEqual({ kind: "thread", id: "pins-room-id", roomKind: "cleanup" })
    expect(pathForEntry({ kind: "thread", id: "x", roomKind: "cleanup", jumpToMessageId: "m9" })).toBe("/messages/x")
  })

  it("keeps the five /settings children apart, and an unknown child resolves to nothing", () => {
    expect(pathForEntry({ kind: "settings" })).toBe("/settings")
    expect(entryFromPath("/settings")).toEqual({ kind: "settings" })
    expect(entryFromPath("/settings/account")).toEqual({ kind: "settings-account" })
    expect(entryFromPath("/settings/privacy")).toEqual({ kind: "settings-privacy" })
    expect(entryFromPath("/settings/blocked")).toEqual({ kind: "blocked" })
    expect(entryFromPath("/settings/language")).toEqual({ kind: "language-settings" })
    expect(entryFromPath("/settings/appearance")).toEqual({ kind: "appearance-settings" })
    expect(entryFromPath("/settings/nope")).toBeNull()
  })

  it("titles every settings surface with a real key (a page with no header has no exit)", () => {
    expect(titleForEntry({ kind: "settings" })).toBe("title.settings")
    expect(titleForEntry({ kind: "settings-account" })).toBe("title.settings_account")
    expect(titleForEntry({ kind: "settings-privacy" })).toBe("title.settings_privacy")
    expect(titleForEntry({ kind: "language-settings" })).toBe("title.language_settings")
    expect(titleForEntry({ kind: "appearance-settings" })).toBe("title.appearance_settings")
  })

  it("maps home both ways", () => {
    expect(pathForEntry(null)).toBe("/")
    expect(entryFromPath("/")).toBeNull()
    expect(entryFromPath("")).toBeNull()
    expect(entryFromPath(undefined)).toBeNull()
  })

  it("aliases /events onto the cleanups list", () => {
    expect(entryFromPath("/events")).toEqual({ kind: "cleanups" })
  })

  it("normalizes the trailing slash, the query string and the hash before parsing", () => {
    expect(entryFromPath("/cleanups/abc/")).toEqual({ kind: "cleanup", id: "abc" })
    expect(entryFromPath("/cleanups/abc?utm=x")).toEqual({ kind: "cleanup", id: "abc" })
    expect(entryFromPath("/cleanups/abc/?utm=x&s=1")).toEqual({ kind: "cleanup", id: "abc" })
    expect(entryFromPath("/cleanups/abc#top")).toEqual({ kind: "cleanup", id: "abc" })
    expect(entryFromPath("/")).toBeNull()
    expect(entryFromPath("/?utm=x")).toBeNull()
    expect(viewFromPath("/map/")).toBe("map")
    expect(viewFromPath("/map?z=12")).toBe("map")
  })

  it("resolves /reports/<id> onto the report detail, and bare /reports onto the list", () => {
    expect(entryFromPath("/reports/xyz")).toEqual({ kind: "pin", id: "xyz" })
    expect(entryFromPath("/reports/xyz/")).toEqual({ kind: "pin", id: "xyz" })
    expect(entryFromPath("/reports")).toEqual({ kind: "myreports" })
    expect(entryFromPath("/reports/")).toEqual({ kind: "myreports" })
    expect(pathForEntry({ kind: "pin", id: "xyz" })).toBe("/pin/xyz")
    expect(pathForEntry({ kind: "myreports" })).toBe("/reports")
  })

  it("ignores the private-route underscore segment", () => {
    expect(entryFromPath("/_/pin/p1")).toEqual({ kind: "pin", id: "p1" })
  })

  it("keeps the drop-pin menu on the map's own URL (deliberately NOT round-trippable)", () => {
    expect(titleForEntry({ kind: "drop-pin" })).toBe("title.drop_pin")
    expect(pathForEntry({ kind: "drop-pin", lat: 37.7749, lng: -122.4194 })).toBe("/map")
  })

  it("round-trips the map and search top-level views", () => {
    expect(pathForView("map")).toBe("/map")
    expect(viewFromPath("/map")).toBe("map")
    expect(pathForView("search")).toBe("/search")
    expect(viewFromPath("/_/search")).toBe("search")
    expect(pathForView("home")).toBeNull()
    expect(viewFromPath("/people")).toBeNull()
  })
})

describe("push: a drill-down back-stack in BOTH modes (append)", () => {
  const a: DetailEntry = { kind: "pin", id: "a" }
  const b: DetailEntry = { kind: "person", id: "b" }

  it("EXPANDED appends, building a stack; active is the new top", () => {
    resetStore("expanded")
    useNavStore.getState().push(a)
    useNavStore.getState().push(b)
    const s = useNavStore.getState()
    expect(s.stack).toEqual([a, b])
    expect(s.active).toEqual(b)
  })

  it("COMPACT also appends, so a drill-down keeps its parent in the back-stack", () => {
    resetStore("compact")
    useNavStore.getState().push(a)
    useNavStore.getState().push(b)
    const s = useNavStore.getState()
    expect(s.stack).toEqual([a, b])
    expect(s.active).toEqual(b)
  })

  it("COMPACT back() from a drill-down returns to the PARENT detail, not home", () => {
    resetStore("compact")
    const profile: DetailEntry = { kind: "profile" }
    const settings: DetailEntry = { kind: "settings" }
    useNavStore.getState().push(profile)
    useNavStore.getState().push(settings)
    useNavStore.getState().back()
    const s = useNavStore.getState()
    expect(s.active).toEqual(profile)
    expect(s.stack).toEqual([profile])
    useNavStore.getState().back()
    expect(useNavStore.getState().active).toBeNull()
  })

  it("COMPACT profile -> settings -> account: each Back pops exactly one settings level", () => {
    resetStore("compact")
    const store = () => useNavStore.getState()
    store().push({ kind: "profile" })
    store().push({ kind: "settings" })
    store().push({ kind: "settings-account" })
    expect(store().stack).toEqual([{ kind: "profile" }, { kind: "settings" }, { kind: "settings-account" }])

    store().back()
    expect(store().active).toEqual({ kind: "settings" })
    store().back()
    expect(store().active).toEqual({ kind: "profile" })
    store().back()
    expect(store().active).toBeNull()
  })

  it("bumps a peeked sheet to mid (snap 0 -> 1) and otherwise keeps the detent", () => {
    resetStore("compact")
    expect(useNavStore.getState().snap).toBe(0)
    useNavStore.getState().push(a)
    expect(useNavStore.getState().snap).toBe(1)
    useNavStore.setState({ snap: 2 })
    useNavStore.getState().push(b)
    expect(useNavStore.getState().snap).toBe(2)
  })
})

describe("openDetail: a lateral/root open that REPLACES the stack (no back-history)", () => {
  const a: DetailEntry = { kind: "pin", id: "a" }
  const b: DetailEntry = { kind: "pin", id: "b" }

  it("replaces any open detail with a single entry (tapping map pin A then pin B)", () => {
    resetStore("compact")
    useNavStore.getState().openDetail(a)
    useNavStore.getState().openDetail(b)
    const s = useNavStore.getState()
    expect(s.stack).toEqual([b])
    expect(s.active).toEqual(b)
  })

  it("replaces a drill-down stack too (Back from a lateral detail closes the sheet)", () => {
    resetStore("compact")
    useNavStore.getState().push({ kind: "person", id: "p" })
    useNavStore.getState().push({ kind: "followers", id: "p" })
    useNavStore.getState().openDetail(a)
    expect(useNavStore.getState().stack).toEqual([a])
    useNavStore.getState().back()
    expect(useNavStore.getState().active).toBeNull()
  })

  it("bumps a peeked sheet to mid like push does", () => {
    resetStore("compact")
    expect(useNavStore.getState().snap).toBe(0)
    useNavStore.getState().openDetail(a)
    expect(useNavStore.getState().snap).toBe(1)
  })
})

describe("selectView", () => {
  it("clears the stack + query, selects the view, opens peek -> mid", () => {
    resetStore("compact")
    useNavStore.getState().push({ kind: "pin", id: "a" })
    useNavStore.getState().setQuery("hello")
    useNavStore.getState().selectView("events")
    const s = useNavStore.getState()
    expect(s.view).toBe("events")
    expect(s.stack).toEqual([])
    expect(s.active).toBeNull()
    expect(s.query).toBe("")
    expect(s.snap).toBe(1)
  })

  it("re-tapping the active view (no detail) deselects it back to the home feed, keeping the snap", () => {
    resetStore("compact")
    useNavStore.getState().selectView("social")
    expect(useNavStore.getState().snap).toBe(1)
    useNavStore.getState().setQuery("hi")
    useNavStore.getState().selectView("social")
    const s = useNavStore.getState()
    expect(s.view).toBe("home")
    expect(s.snap).toBe(1)
    expect(s.stack).toEqual([])
    expect(s.active).toBeNull()
    expect(s.query).toBe("")
  })

  it("does NOT collapse on re-tap when a detail is open (it clears the detail instead)", () => {
    resetStore("compact")
    useNavStore.getState().selectView("social")
    useNavStore.getState().push({ kind: "person", id: "z" })
    useNavStore.getState().selectView("social")
    const s = useNavStore.getState()
    expect(s.active).toBeNull()
    expect(s.stack).toEqual([])
    expect(s.snap).toBe(1)
    expect(s.view).toBe("social")
  })

  it("uses feed-first detents for the four navigation destinations", () => {
    resetStore("compact")
    useNavStore.getState().selectView("map")
    expect(useNavStore.getState().snap).toBe(0)

    useNavStore.getState().selectView("home")
    expect(useNavStore.getState().snap).toBe(2)

    useNavStore.getState().selectView("messaging")
    expect(useNavStore.getState().snap).toBe(2)

    useNavStore.getState().selectView("search")
    expect(useNavStore.getState().snap).toBe(2)
  })

  it("re-tapping the active Map tab is a no-op: Map is the default destination, not a detour", () => {
    resetStore("compact")
    useNavStore.getState().selectView("map")
    expect(useNavStore.getState().snap).toBe(0)

    const before = useNavStore.getState()
    const calls = countNotifications(() => useNavStore.getState().selectView("map"))
    const s = useNavStore.getState()
    expect(calls).toBe(0)
    expect(s.view).toBe("map")
    expect(s.snap).toBe(0)
    expect(s.stack).toBe(before.stack)
    expect(s.active).toBeNull()
  })

  it("still clears an open detail when the active Map tab is re-tapped", () => {
    resetStore("compact")
    useNavStore.getState().selectView("map")
    useNavStore.getState().openDetail({ kind: "pin", id: "r1" })
    useNavStore.getState().selectView("map")
    const s = useNavStore.getState()
    expect(s.view).toBe("map")
    expect(s.stack).toEqual([])
    expect(s.active).toBeNull()
    expect(s.snap).toBe(0)
  })
})

describe("back()", () => {
  it("pops one entry and recomputes active", () => {
    resetStore("expanded")
    const a: DetailEntry = { kind: "cleanups" }
    const b: DetailEntry = { kind: "cleanup", id: "c1" }
    useNavStore.getState().push(a)
    useNavStore.getState().push(b)
    useNavStore.getState().back()
    const s = useNavStore.getState()
    expect(s.stack).toEqual([a])
    expect(s.active).toEqual(a)
  })

  it("at home (empty stack) stays home; active null", () => {
    resetStore("expanded")
    useNavStore.getState().back()
    const s = useNavStore.getState()
    expect(s.stack).toEqual([])
    expect(s.active).toBeNull()
  })

  it("popping the last entry returns active to null, leaving view/snap/query", () => {
    resetStore("expanded")
    useNavStore.setState({ view: "reports", snap: 2, query: "q" })
    useNavStore.getState().push({ kind: "myreports" })
    useNavStore.getState().back()
    const s = useNavStore.getState()
    expect(s.active).toBeNull()
    expect(s.view).toBe("reports")
    expect(s.snap).toBe(2)
    expect(s.query).toBe("q")
  })
})

describe("collapseToParent() (drag-to-collapse a detail dismisses the sheet)", () => {
  it("a DEEP-LINKED detail with a list tab falls back to that View, clearing the detail + query", () => {
    useNavStore.getState().seed({ kind: "pin", id: "r1" }, "compact")
    useNavStore.getState().setQuery("leftover")
    expect(useNavStore.getState().originView).toBeNull()

    useNavStore.getState().collapseToParent()
    const s = useNavStore.getState()
    expect(s.view).toBe("reports")
    expect(s.stack).toEqual([])
    expect(s.active).toBeNull()
    expect(s.query).toBe("")
  })

  it("maps each list-child detail kind to its parent view", () => {
    expect(parentViewForEntry({ kind: "cleanup", id: "c" })).toBe("events")
    expect(parentViewForEntry({ kind: "person", id: "p" })).toBe("social")
    expect(parentViewForEntry({ kind: "thread", id: "t" })).toBe("messaging")
    expect(parentViewForEntry({ kind: "pin", id: "r" })).toBe("reports")
    expect(parentViewForEntry({ kind: "activity" })).toBeNull()
    expect(parentViewForEntry({ kind: "profile" })).toBeNull()
    expect(parentViewForEntry(null)).toBeNull()
  })

  it("a detail with no list tab clears back to the current view (keeps view)", () => {
    useNavStore.setState({ view: "social" })
    useNavStore.getState().push({ kind: "profile" })
    useNavStore.getState().collapseToParent()
    const s = useNavStore.getState()
    expect(s.active).toBeNull()
    expect(s.stack).toEqual([])
    expect(s.view).toBe("social")
  })

  it("does NOT abandon an in-progress edit (edit-cleanup)", () => {
    useNavStore.getState().push({ kind: "edit-cleanup", id: "c1" })
    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().active).toEqual({ kind: "edit-cleanup", id: "c1" })
  })

  it("does NOT abandon host-an-event (create-cleanup) - its meet-location map picker collapses the sheet", () => {
    resetStore()
    useNavStore.getState().push({ kind: "create-cleanup" })
    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().active).toEqual({ kind: "create-cleanup" })
  })

  it("does NOT abandon an in-progress post composer", () => {
    useNavStore.getState().push({ kind: "composer" })
    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().active).toEqual({ kind: "composer" })
  })

  it("is a no-op when no detail is open (collapsing a bare list)", () => {
    useNavStore.setState({ view: "events", snap: 0 })
    useNavStore.getState().collapseToParent()
    const s = useNavStore.getState()
    expect(s.view).toBe("events")
    expect(s.active).toBeNull()
  })
})

describe("originView (a pull-up dismisses back to where it was opened from)", () => {
  it("THE REPRO: a pin opened on the MAP tab dismisses back to the MAP, not to the Reports list", () => {
    useNavStore.getState().selectView("map")
    useNavStore.getState().openDetail({ kind: "pin", id: "r1" })
    expect(useNavStore.getState().originView).toBe("map")

    useNavStore.getState().collapseToParent()
    const s = useNavStore.getState()
    expect(s.view).toBe("map")
    expect(s.stack).toEqual([])
    expect(s.active).toBeNull()
    expect(s.originView).toBeNull()
  })

  it("...and the SAME pin opened from the Reports list dismisses back to the Reports list", () => {
    useNavStore.getState().selectView("reports")
    useNavStore.getState().push({ kind: "pin", id: "r1" })
    expect(useNavStore.getState().originView).toBe("reports")

    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().view).toBe("reports")
  })

  it("records the origin ONLY on the empty -> first-entry transition", () => {
    useNavStore.getState().selectView("map")
    useNavStore.getState().openDetail({ kind: "pin", id: "a" })
    expect(useNavStore.getState().originView).toBe("map")

    useNavStore.setState({ view: "social" })
    useNavStore.getState().openDetail({ kind: "pin", id: "b" })
    expect(useNavStore.getState().originView).toBe("map")

    useNavStore.getState().push({ kind: "person", id: "p" })
    expect(useNavStore.getState().originView).toBe("map")
    expect(useNavStore.getState().stack).toHaveLength(2)
  })

  it("collapsing a DRILLED-IN stack still returns to the origin (collapse clears the whole stack)", () => {
    useNavStore.getState().selectView("map")
    useNavStore.getState().openDetail({ kind: "pin", id: "a" })
    useNavStore.getState().push({ kind: "person", id: "p" })
    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().view).toBe("map")
  })

  it("leaves back() alone: it pops to the REAL parent, and only releases the origin at the root", () => {
    useNavStore.getState().selectView("map")
    useNavStore.getState().openDetail({ kind: "pin", id: "a" })
    useNavStore.getState().push({ kind: "person", id: "p" })

    useNavStore.getState().back()
    let s = useNavStore.getState()
    expect(s.active).toEqual({ kind: "pin", id: "a" })
    expect(s.view).toBe("map")
    expect(s.originView).toBe("map")

    useNavStore.getState().back()
    s = useNavStore.getState()
    expect(s.stack).toEqual([])
    expect(s.originView).toBeNull()
    expect(s.view).toBe("map")
  })

  it("keeps the DEEP-LINK fallback: a seeded detail has no origin and collapses to its owning list", () => {
    useNavStore.getState().selectView("map")
    useNavStore.getState().openDetail({ kind: "pin", id: "a" })
    expect(useNavStore.getState().originView).toBe("map")

    useNavStore.getState().seed({ kind: "pin", id: "deep" }, "compact")
    expect(useNavStore.getState().originView).toBeNull()
    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().view).toBe("reports")
  })

  it("clears the origin on selectView / reset, so it cannot resurrect a view the user has left", () => {
    useNavStore.getState().selectView("map")
    useNavStore.getState().openDetail({ kind: "pin", id: "a" })
    useNavStore.getState().selectView("messaging")
    expect(useNavStore.getState().originView).toBeNull()

    useNavStore.getState().push({ kind: "person", id: "p" })
    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().view).toBe("messaging")

    useNavStore.getState().selectView("map")
    useNavStore.getState().openDetail({ kind: "pin", id: "a" })
    useNavStore.getState().reset()
    expect(useNavStore.getState().originView).toBeNull()
    expect(useNavStore.getState().view).toBe("home")
  })

  it("composes with FLOW_KINDS: the no-op guard wins and PRESERVES the origin for the real exit", () => {
    useNavStore.getState().selectView("events")
    useNavStore.getState().push({ kind: "create-cleanup" })
    expect(useNavStore.getState().originView).toBe("events")

    useNavStore.getState().collapseToParent()
    let s = useNavStore.getState()
    expect(s.active).toEqual({ kind: "create-cleanup" })
    expect(s.originView).toBe("events")

    useNavStore.getState().back()
    s = useNavStore.getState()
    expect(s.active).toBeNull()
    expect(s.view).toBe("events")
    expect(s.originView).toBeNull()
  })

  it("treats setStack as an IN-SHEET rewrite (origin kept) that releases the origin when emptied", () => {
    useNavStore.getState().selectView("map")
    useNavStore.getState().openDetail({ kind: "pin", id: "a" })
    useNavStore.getState().setStack([{ kind: "thread", id: "t", roomKind: "dm" }])
    expect(useNavStore.getState().originView).toBe("map")

    useNavStore.getState().setStack([])
    expect(useNavStore.getState().originView).toBeNull()
  })

  it("KEEPS the query when the collapse stays on the view it came from (the Search page)", () => {
    useNavStore.getState().selectView("search")
    useNavStore.getState().setQuery("jane")
    useNavStore.getState().push({ kind: "person", id: "jane" })
    expect(useNavStore.getState().originView).toBe("search")
    expect(useNavStore.getState().query).toBe("jane")

    useNavStore.getState().collapseToParent()
    const s = useNavStore.getState()
    expect(s.view).toBe("search")
    expect(s.query).toBe("jane")
    expect(s.active).toBeNull()
  })

  it("keeps a list header's query too - the pull-up was only ever on TOP of that list", () => {
    useNavStore.getState().selectView("reports")
    useNavStore.getState().setQuery("pothole")
    useNavStore.getState().push({ kind: "pin", id: "r1" })
    useNavStore.getState().collapseToParent()
    const s = useNavStore.getState()
    expect(s.view).toBe("reports")
    expect(s.query).toBe("pothole")
  })

  it("still clears the query on the deep-link fallback, which really does change view", () => {
    useNavStore.getState().seed({ kind: "pin", id: "deep" }, "compact")
    useNavStore.getState().setQuery("leftover")
    useNavStore.getState().collapseToParent()
    const s = useNavStore.getState()
    expect(s.view).toBe("reports")
    expect(s.query).toBe("")
  })

  it("holds the SHARPER invariant: a non-null origin always equals the current view", () => {
    const assertPinned = () => {
      const { view, originView } = useNavStore.getState()
      if (originView !== null) expect(originView).toBe(view)
    }
    const store = () => useNavStore.getState()
    store().selectView("map")
    store().openDetail({ kind: "pin", id: "a" })
    assertPinned()
    store().selectView("home")
    expect(store().originView).toBeNull()
    expect(store().stack).toEqual([])
    store().collapseToParent()
    expect(store().view).toBe("home")

    store().selectView("events")
    store().push({ kind: "cleanup", id: "c" })
    assertPinned()
    store().push({ kind: "person", id: "p" })
    assertPinned()
    store().setStack([{ kind: "thread", id: "t", roomKind: "dm" }])
    assertPinned()
    store().back()
    assertPinned()
    store().collapseToParent()
    assertPinned()
  })

  it("holds the invariant: a non-null origin always implies a non-empty stack", () => {
    const assertInvariant = () => {
      const { stack, originView } = useNavStore.getState()
      if (originView !== null) expect(stack.length).toBeGreaterThan(0)
    }
    const store = () => useNavStore.getState()
    assertInvariant()
    store().selectView("map")
    assertInvariant()
    store().openDetail({ kind: "pin", id: "a" })
    assertInvariant()
    store().push({ kind: "person", id: "p" })
    assertInvariant()
    store().back()
    assertInvariant()
    store().back()
    assertInvariant()
    store().push({ kind: "cleanup", id: "c" })
    assertInvariant()
    store().collapseToParent()
    assertInvariant()
    store().seed({ kind: "pin", id: "z" }, "compact")
    assertInvariant()
    store().setStack([])
    assertInvariant()
    store().reset()
    assertInvariant()
  })
})

describe("reset()", () => {
  it("returns to the full home feed with an empty stack + query", () => {
    resetStore("expanded")
    useNavStore.setState({ view: "social", snap: 2, query: "hi" })
    useNavStore.getState().push({ kind: "person", id: "p" })
    useNavStore.getState().reset()
    const s = useNavStore.getState()
    expect(s.view).toBe("home")
    expect(s.stack).toEqual([])
    expect(s.active).toBeNull()
    expect(s.snap).toBe(2)
    expect(s.query).toBe("")
  })
})

describe("setStack / setSnap / setQuery", () => {
  it("setStack replaces the stack and sets active to the last entry", () => {
    resetStore("expanded")
    const stack: DetailEntry[] = [{ kind: "cleanups" }, { kind: "cleanup", id: "c1" }]
    useNavStore.getState().setStack(stack)
    const s = useNavStore.getState()
    expect(s.stack).toEqual(stack)
    expect(s.active).toEqual({ kind: "cleanup", id: "c1" })
  })

  it("setStack([]) clears active to null", () => {
    resetStore("expanded")
    useNavStore.getState().setStack([{ kind: "pin", id: "a" }])
    useNavStore.getState().setStack([])
    expect(useNavStore.getState().active).toBeNull()
  })

  it("setSnap / setQuery touch only their own field", () => {
    resetStore("compact")
    useNavStore.getState().setSnap(2)
    useNavStore.getState().setQuery("abc")
    const s = useNavStore.getState()
    expect(s.snap).toBe(2)
    expect(s.query).toBe("abc")
    expect(s.view).toBe("home")
    expect(s.stack).toEqual([])
  })

  it("setSnap defaults to animated; animated:false marks the change instant", () => {
    resetStore("compact")
    useNavStore.getState().setSnap(1)
    expect(useNavStore.getState().snapAnimated).toBe(true)
    useNavStore.getState().setSnap(2, false)
    expect(useNavStore.getState().snap).toBe(2)
    expect(useNavStore.getState().snapAnimated).toBe(false)
    useNavStore.getState().setSnap(1, true)
    expect(useNavStore.getState().snapAnimated).toBe(true)
  })

  it("push / selectView / reset re-enable the height animation after an instant snap", () => {
    resetStore("compact")
    useNavStore.getState().setSnap(2, false)
    useNavStore.getState().push({ kind: "pin", id: "p1" })
    expect(useNavStore.getState().snapAnimated).toBe(true)

    useNavStore.getState().setSnap(2, false)
    useNavStore.getState().selectView("reports")
    expect(useNavStore.getState().snapAnimated).toBe(true)

    useNavStore.getState().setSnap(2, false)
    useNavStore.getState().reset()
    expect(useNavStore.getState().snapAnimated).toBe(true)
  })
})

describe("report tab view", () => {
  it("selects the report view full-height with no detail stack", () => {
    resetStore("compact")
    useNavStore.getState().selectView("report")
    const s = useNavStore.getState()
    expect(s.view).toBe("report")
    expect(s.stack).toEqual([])
    expect(s.active).toBeNull()
    expect(s.snap).toBe(2)
  })

  it("re-tapping the report tab deselects back to the home feed", () => {
    resetStore("compact")
    useNavStore.getState().selectView("report")
    useNavStore.getState().selectView("report")
    expect(useNavStore.getState().view).toBe("home")
  })

  it("round-trips the report view through /report", () => {
    expect(pathForEntry({ kind: "view", view: "report" })).toBe("/report")
    expect(entryFromPath("/report")).toEqual({ kind: "view", view: "report" })
  })

  it("seeds the report view full-height from a route entry", () => {
    expect(seedFor({ kind: "view", view: "report" }, "compact")).toEqual({
      view: "report",
      stack: [],
      snap: 2,
    })
  })
})

describe("active === top-of-stack invariant", () => {
  it("holds across a push/push/back/back/reset sequence in expanded mode", () => {
    resetStore("expanded")
    const expectInvariant = () => {
      const s = useNavStore.getState()
      expect(s.active).toEqual(s.stack[s.stack.length - 1] ?? null)
    }
    const seq: DetailEntry[] = [{ kind: "cleanups" }, { kind: "cleanup", id: "c1" }, { kind: "thread", id: "r1", roomKind: "cleanup" }]
    seq.forEach((e) => {
      useNavStore.getState().push(e)
      expectInvariant()
    })
    useNavStore.getState().back()
    expectInvariant()
    useNavStore.getState().back()
    expectInvariant()
    useNavStore.getState().reset()
    expectInvariant()
  })
})

describe("seedFor", () => {
  const detail: DetailEntry = { kind: "pin", id: "p1" }

  const listKinds: Array<[DetailEntry, View, string]> = [
    [{ kind: "cleanups" }, "events", "/cleanups"],
    [{ kind: "people" }, "social", "/people"],
    [{ kind: "myreports" }, "reports", "/reports"],
    [{ kind: "messages" }, "messaging", "/messages"],
  ]

  it.each(listKinds)(
    "%o seeds its VIEW with an empty stack in BOTH modes (the list-kind<->view duality is gone)",
    (entry, view) => {
      expect(seedFor(entry, "compact")).toEqual({ view, stack: [] })
      expect(seedFor(entry, "expanded")).toEqual({ view, stack: [] })
    },
  )

  it.each(listKinds)(
    "%o round-trips path -> entry -> view -> path, so the address bar survives the view-rooted seed",
    (entry, view, path) => {
      expect(entryFromPath(path)).toEqual(entry)
      expect(viewForEntry(entry)).toBe(view)
      expect(pathForEntry(entry)).toBe(path)
    },
  )

  it("a true detail seeds a stack in BOTH modes (compact also pins view=home)", () => {
    expect(seedFor(detail, "expanded")).toEqual({ stack: [detail] })
    expect(seedFor(detail, "compact")).toEqual({ stack: [detail], view: "home" })
  })

  it("null (home) seeds nothing", () => {
    expect(seedFor(null, "compact")).toEqual({})
    expect(seedFor(null, "expanded")).toEqual({})
  })

  it.each([
    ["/map", "map", 0],
    ["/search", "search", 2],
  ] as const)("seeds %s through the adapter entryFromPath -> seedFor flow", (path, view, snap) => {
    const entry = entryFromPath(path)
    expect(seedFor(entry, "compact")).toEqual({ view, stack: [], snap })
    expect(pathForEntry(entry)).toBe(path)
  })
})

describe("seed (store action)", () => {
  const list: DetailEntry = { kind: "cleanups" }
  const detail: DetailEntry = { kind: "pin", id: "p1" }
  const expectInvariant = () => {
    const s = useNavStore.getState()
    expect(s.active).toEqual(s.stack[s.stack.length - 1] ?? null)
  }

  it.each(["compact", "expanded"] as const)(
    "%s list-kind: selects the view, clears the stack AND recomputes active to null",
    (mode) => {
      useNavStore.getState().push(detail)
      useNavStore.getState().seed(list, mode)
      const s = useNavStore.getState()
      expect(s.view).toBe("events")
      expect(s.stack).toEqual([])
      expect(s.active).toBeNull()
      expectInvariant()
    },
  )

  it("a true detail: seeds the single-entry stack AND makes it active in both modes", () => {
    useNavStore.getState().seed(detail, "compact")
    expect(useNavStore.getState().active).toEqual(detail)
    expect(useNavStore.getState().stack).toEqual([detail])
    expectInvariant()

    useNavStore.getState().reset()
    useNavStore.getState().seed(detail, "expanded")
    expect(useNavStore.getState().active).toEqual(detail)
    expectInvariant()
  })

  it("null (home) clears a stale panel instead of no-opping like seedFor({}) would", () => {
    useNavStore.getState().push(detail)
    useNavStore.getState().seed(null, "compact")
    const s = useNavStore.getState()
    expect(s.view).toBe("home")
    expect(s.stack).toEqual([])
    expect(s.active).toBeNull()
    expectInvariant()
  })

  it("keeps the surface it was seeded FROM, so Back returns there (person opened from Messages)", () => {
    useNavStore.getState().selectView("messaging")
    useNavStore.getState().seed({ kind: "person", id: "p1" }, "compact")
    expect(useNavStore.getState().view).toBe("messaging")
    expect(useNavStore.getState().stack).toEqual([{ kind: "person", id: "p1" }])

    useNavStore.getState().back()
    const s = useNavStore.getState()
    expect(s.view).toBe("messaging")
    expect(s.stack).toEqual([])
    expect(s.active).toBeNull()
    expectInvariant()
  })

  it.each(["home", "search", "reports"] as const)(
    "keeps %s too, so a profile opened from Feed / Search / a list returns to its origin view",
    (view) => {
      useNavStore.getState().selectView(view)
      useNavStore.getState().seed({ kind: "profile" }, "compact")
      useNavStore.getState().back()
      expect(useNavStore.getState().view).toBe(view)
    },
  )

  it("falls back to the feed from the map, which renders no base body behind a detail", () => {
    useNavStore.getState().selectView("map")
    useNavStore.getState().seed({ kind: "person", id: "p1" }, "compact")
    expect(useNavStore.getState().view).toBe("home")
  })

  it("a view entry carries seedFor's snap through (map seeds peek)", () => {
    useNavStore.getState().seed({ kind: "view", view: "map" }, "compact")
    const s = useNavStore.getState()
    expect(s.view).toBe("map")
    expect(s.snap).toBe(0)
    expect(s.active).toBeNull()
    expectInvariant()
  })
})

describe("seed derives the detent from the PRISTINE store (a cold compact web load)", () => {
  it("a bare seed lands on the home feed at the home detent, not the map's peek", () => {
    resetPristine()
    useNavStore.getState().seed(null, "compact")
    const s = useNavStore.getState()
    expect(s.view).toBe("home")
    expect(s.snap).toBe(2)
  })

  it.each([
    ["/host", { kind: "create-cleanup" } as DetailEntry],
    ["/settings", { kind: "settings" } as DetailEntry],
    ["/settings/privacy", { kind: "settings-privacy" } as DetailEntry],
    ["/dashboard", { kind: "event-dashboard" } as DetailEntry],
    ["/profile", { kind: "profile" } as DetailEntry],
    ["/leaderboard/0644000", { kind: "leaderboard", geoid: "0644000" } as DetailEntry],
    ["/people/u1/followers", { kind: "followers", id: "u1" } as DetailEntry],
    [
      "/messages/members/group/g1",
      { kind: "members", id: "g1", roomKind: "group" } as DetailEntry,
    ],
  ])("a cold deep link to %s opens the sheet full, never at the 96px peek", (path, entry) => {
    resetPristine()
    const seeded = entryFromPath(path)
    expect(seeded).toEqual(entry)
    useNavStore.getState().seed(seeded, "compact")
    const s = useNavStore.getState()
    expect(s.stack).toEqual([entry])
    expect(s.snap).toBe(2)
  })

  it("keeps a seeded list kind on its own view detent", () => {
    resetPristine()
    useNavStore.getState().seed({ kind: "messages" }, "compact")
    expect(useNavStore.getState().view).toBe("messaging")
    expect(useNavStore.getState().snap).toBe(2)
  })

  it("a seeded map view still peeks, so the map is the surface", () => {
    resetPristine()
    useNavStore.getState().seed(entryFromPath("/map"), "compact")
    expect(useNavStore.getState().view).toBe("map")
    expect(useNavStore.getState().snap).toBe(0)
  })
})

describe("viewForEntry / titleForEntry / searchModeFor", () => {
  it("maps the four list kinds to their compact tab; everything else is null", () => {
    const expected: Array<[DetailEntry, View | null]> = [
      [{ kind: "myreports" }, "reports"],
      [{ kind: "cleanups" }, "events"],
      [{ kind: "people" }, "social"],
      [{ kind: "messages" }, "messaging"],
      [{ kind: "activity" }, null],
      [{ kind: "notification-prefs" }, null],
      [{ kind: "pin", id: "x" }, null],
      [{ kind: "cleanup", id: "x" }, null],
      [{ kind: "person", id: "x" }, null],
    ]
    for (const [entry, view] of expected) {
      expect(viewForEntry(entry)).toBe(view)
    }
    expect(viewForEntry(null)).toBeNull()
  })

  it("titleForEntry returns the stable nav-namespace i18n key per kind (translated at the render site)", () => {
    expect(titleForEntry({ kind: "pin", id: "x" })).toBe("title.pin")
    expect(titleForEntry({ kind: "cleanups" })).toBe("title.cleanups")
    expect(titleForEntry({ kind: "profile" })).toBe("title.profile")
    expect(titleForEntry(null)).toBe("")
    expect(titleForEntry({ kind: "thread", id: "x", roomKind: "cleanup" })).toBe(" ")
    expect(titleForEntry({ kind: "members", id: "room1", roomKind: "cleanup" })).toBe(
      "title.chat_info",
    )
    expect(titleForEntry({ kind: "members", id: "room1", roomKind: "report" })).toBe(
      "title.chat_info",
    )
    expect(titleForEntry({ kind: "members", id: "room1", roomKind: "group" })).toBe("title.members")
    expect(titleForEntry({ kind: "cluster", reports: [] })).toBe("title.cluster")
  })

  it("titleParamsForEntry carries the cluster COUNT (so i18next picks the locale's own plural form)", () => {
    const one = { kind: "cluster", reports: [{ id: "r1" }] } as unknown as DetailEntry
    const three = { kind: "cluster", reports: [{ id: "r1" }, { id: "r2" }, { id: "r3" }] } as unknown as DetailEntry
    expect(titleParamsForEntry(one)).toEqual({ count: 1 })
    expect(titleParamsForEntry(three)).toEqual({ count: 3 })
    expect(titleParamsForEntry({ kind: "cluster" })).toEqual({ count: 0 })
    expect(titleParamsForEntry({ kind: "pin", id: "x" })).toEqual({})
    expect(titleParamsForEntry(null)).toEqual({})
  })

  it("searchModeFor switches between search and detail mode and picks the right placeholder KEY", () => {
    expect(searchModeFor("home", null)).toEqual({ mode: "search", placeholder: "placeholder.places_events", kind: "places" })
    expect(searchModeFor("messaging", null)).toEqual({ mode: "search", placeholder: "placeholder.people", kind: "people" })
    expect(searchModeFor("reports", null)).toEqual({ mode: "search", placeholder: "placeholder.reports", kind: "reports" })
    expect(searchModeFor("search", null)).toEqual({ mode: "search", placeholder: "placeholder.search", kind: "places" })
    expect(searchModeFor("home", { kind: "pin", id: "x" }).mode).toBe("detail")
  })

  it("uses own-header sentinels for composer/thread and titles for post/saves", () => {
    expect(titleForEntry({ kind: "post", id: "p1" })).toBe("title.post")
    expect(titleForEntry({ kind: "saves" })).toBe("title.saves")
    expect(titleForEntry({ kind: "post-thread", id: "p1" })).toBe(" ")
    expect(titleForEntry({ kind: "composer" })).toBe(" ")
    expect(titleForEntry({ kind: "person", id: "x" })).toBe(" ")
  })
})
