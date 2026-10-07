import { readFileSync } from "node:fs"
import ts from "typescript"
import { describe, expect, it } from "vitest"
import {
  entryFromPath,
  entryIdentity,
  parentViewForEntry,
  pathForEntry,
  titleForEntry,
  titleParamsForEntry,
  viewForEntry,
} from "../routes"
import { ALL_DETAIL_KINDS, type DetailEntry, type DetailKind, type View } from "../types"

type RouteCase = {
  entry: DetailEntry
  path: string
  /** What the path parses back to, when that is not `entry` itself (the kind has no address of its own). */
  parsed?: DetailEntry | null
  title: string
  parentView: View | null
  view: View | null
}

const BEACH_DAY = { id: "c1", title: "Beach day" } as unknown as NonNullable<DetailEntry["event"]>
const TWO_REPORTS = [{ id: "r1" }, { id: "r2" }] as unknown as NonNullable<DetailEntry["reports"]>

const ROUTES = {
  pin: [
    { entry: { kind: "pin", id: "r1" }, path: "/pin/r1", title: "title.pin", parentView: "reports", view: null },
  ],
  cleanup: [
    { entry: { kind: "cleanup", id: "c1" }, path: "/cleanups/c1", title: "title.cleanup", parentView: "events", view: null },
  ],
  person: [
    { entry: { kind: "person", id: "u1" }, path: "/people/u1", title: " ", parentView: "social", view: null },
  ],
  thread: [
    { entry: { kind: "thread", id: "c1", roomKind: "cleanup" }, path: "/messages/c1", title: " ", parentView: "messaging", view: null },
    { entry: { kind: "thread", id: "d1", roomKind: "dm" }, path: "/messages/dm/d1", title: " ", parentView: "messaging", view: null },
    { entry: { kind: "thread", id: "r1", roomKind: "report" }, path: "/messages/report/r1", title: " ", parentView: "messaging", view: null },
    { entry: { kind: "thread", id: "g1", roomKind: "group" }, path: "/messages/group/g1", title: " ", parentView: "messaging", view: null },
  ],
  myreports: [
    { entry: { kind: "myreports" }, path: "/reports", title: "title.myreports", parentView: "reports", view: "reports" },
  ],
  cleanups: [
    { entry: { kind: "cleanups" }, path: "/cleanups", title: "title.cleanups", parentView: "events", view: "events" },
  ],
  people: [
    { entry: { kind: "people" }, path: "/people", title: "title.people", parentView: "social", view: "social" },
  ],
  messages: [
    { entry: { kind: "messages" }, path: "/messages", title: "title.messages", parentView: "messaging", view: "messaging" },
  ],
  "new-msg": [
    { entry: { kind: "new-msg" }, path: "/messages", parsed: { kind: "messages" }, title: "title.new_msg", parentView: null, view: null },
  ],
  activity: [
    { entry: { kind: "activity" }, path: "/notifications", title: "title.activity", parentView: null, view: null },
  ],
  "notification-prefs": [
    { entry: { kind: "notification-prefs" }, path: "/notifications/prefs", title: "title.notification_prefs", parentView: null, view: null },
  ],
  profile: [
    { entry: { kind: "profile" }, path: "/profile", title: "title.profile", parentView: null, view: null },
  ],
  "create-cleanup": [
    { entry: { kind: "create-cleanup" }, path: "/host", title: "title.create_cleanup", parentView: null, view: null },
  ],
  "edit-cleanup": [
    { entry: { kind: "edit-cleanup", id: "c1" }, path: "/cleanups/c1/edit", title: "title.edit_cleanup", parentView: null, view: null },
  ],
  cluster: [
    { entry: { kind: "cluster" }, path: "/", parsed: null, title: "title.cluster", parentView: null, view: null },
  ],
  blend: [
    { entry: { kind: "blend" }, path: "/", parsed: null, title: "title.cleanup", parentView: null, view: null },
    { entry: { kind: "blend", event: BEACH_DAY }, path: "/", parsed: null, title: "Beach day", parentView: null, view: null },
  ],
  followers: [
    { entry: { kind: "followers", id: "u1" }, path: "/people/u1/followers", title: "title.followers", parentView: null, view: null },
  ],
  following: [
    { entry: { kind: "following", id: "u1" }, path: "/people/u1/following", title: "title.following", parentView: null, view: null },
  ],
  leaderboard: [
    { entry: { kind: "leaderboard", geoid: "06037" }, path: "/leaderboard/06037", title: "title.leaderboard", parentView: null, view: null },
  ],
  blocked: [
    { entry: { kind: "blocked" }, path: "/settings/blocked", title: "title.blocked", parentView: null, view: null },
  ],
  members: [
    { entry: { kind: "members", id: "m1", roomKind: "cleanup" }, path: "/messages/members/cleanup/m1", title: "title.chat_info", parentView: null, view: null },
    { entry: { kind: "members", id: "m1", roomKind: "report" }, path: "/messages/members/report/m1", title: "title.chat_info", parentView: null, view: null },
    { entry: { kind: "members", id: "m1", roomKind: "dm" }, path: "/messages/members/dm/m1", title: "title.members", parentView: null, view: null },
    { entry: { kind: "members", id: "m1", roomKind: "group" }, path: "/messages/members/group/m1", title: "title.members", parentView: null, view: null },
  ],
  "language-settings": [
    { entry: { kind: "language-settings" }, path: "/settings/language", title: "title.language_settings", parentView: null, view: null },
  ],
  "appearance-settings": [
    { entry: { kind: "appearance-settings" }, path: "/settings/appearance", title: "title.appearance_settings", parentView: null, view: null },
  ],
  settings: [
    { entry: { kind: "settings" }, path: "/settings", title: "title.settings", parentView: null, view: null },
  ],
  "settings-account": [
    { entry: { kind: "settings-account" }, path: "/settings/account", title: "title.settings_account", parentView: null, view: null },
  ],
  "settings-privacy": [
    { entry: { kind: "settings-privacy" }, path: "/settings/privacy", title: "title.settings_privacy", parentView: null, view: null },
  ],
  "pinned-messages": [
    { entry: { kind: "pinned-messages", id: "room1", roomKind: "cleanup" }, path: "/messages/pins/cleanup/room1", title: " ", parentView: "messaging", view: null },
    { entry: { kind: "pinned-messages", id: "room1", roomKind: "report" }, path: "/messages/pins/report/room1", title: " ", parentView: "messaging", view: null },
    { entry: { kind: "pinned-messages", id: "room1", roomKind: "dm" }, path: "/messages/pins/dm/room1", title: " ", parentView: "messaging", view: null },
    { entry: { kind: "pinned-messages", id: "room1", roomKind: "group" }, path: "/messages/pins/group/room1", title: " ", parentView: "messaging", view: null },
  ],
  "new-group": [
    { entry: { kind: "new-group" }, path: "/groups/new", title: " ", parentView: "messaging", view: null },
  ],
  "new-channel": [
    { entry: { kind: "new-channel" }, path: "/channels/new", title: " ", parentView: "messaging", view: null },
  ],
  "group-info": [
    { entry: { kind: "group-info", id: "g1" }, path: "/groups/g1/info", title: "title.group_info", parentView: "messaging", view: null },
  ],
  post: [
    { entry: { kind: "post", id: "p1" }, path: "/post/p1", title: "title.post", parentView: "home", view: null },
  ],
  "post-thread": [
    { entry: { kind: "post-thread", id: "p1" }, path: "/post/p1/thread", title: " ", parentView: "home", view: null },
  ],
  composer: [
    { entry: { kind: "composer" }, path: "/compose", title: " ", parentView: null, view: null },
    { entry: { kind: "composer", composerMode: "quote", targetPostId: "p1" }, path: "/compose/quote/p1", title: " ", parentView: null, view: null },
  ],
  saves: [
    { entry: { kind: "saves" }, path: "/saves", title: "title.saves", parentView: "home", view: null },
  ],
  "drop-pin": [
    { entry: { kind: "drop-pin", lat: 34.05, lng: -118.25 }, path: "/map", parsed: { kind: "view", view: "map" }, title: "title.drop_pin", parentView: "map", view: null },
  ],
  "host-mode": [
    { entry: { kind: "host-mode", id: "c1" }, path: "/cleanups/c1/host", title: "title.host_mode", parentView: "events", view: null },
  ],
  "host-checkin": [
    { entry: { kind: "host-checkin", id: "c1" }, path: "/cleanups/c1/checkin", title: "title.host_checkin", parentView: "events", view: null },
  ],
  "host-announce": [
    { entry: { kind: "host-announce", id: "c1" }, path: "/cleanups/c1/announce", title: "title.host_announce", parentView: "events", view: null },
  ],
  "host-team": [
    { entry: { kind: "host-team", id: "c1" }, path: "/cleanups/c1/team", title: "title.host_team", parentView: "events", view: null },
  ],
  "host-log-hours": [
    { entry: { kind: "host-log-hours", id: "c1" }, path: "/cleanups/c1/hours", title: "title.host_log_hours", parentView: "events", view: null },
  ],
  "my-ticket": [
    { entry: { kind: "my-ticket", id: "c1" }, path: "/cleanups/c1/ticket", title: "title.my_ticket", parentView: "events", view: null },
    { entry: { kind: "my-ticket", id: "c1", seatId: "s1" }, path: "/cleanups/c1/ticket/s1", title: "title.my_ticket", parentView: "events", view: null },
  ],
  org: [
    { entry: { kind: "org", slug: "acme" }, path: "/orgs/acme", title: "title.org", parentView: "events", view: null },
  ],
  "event-dashboard": [
    { entry: { kind: "event-dashboard" }, path: "/dashboard", title: "title.event_dashboard", parentView: "events", view: null },
  ],
  announcement: [
    { entry: { kind: "announcement", id: "c1", announcementId: "a1" }, path: "/cleanups/c1/announcements/a1", title: "title.announcement", parentView: "events", view: null },
  ],
  announcements: [
    { entry: { kind: "announcements", id: "c1" }, path: "/cleanups/c1/announcements", title: "title.announcements", parentView: "events", view: null },
  ],
  "event-analytics": [
    { entry: { kind: "event-analytics", id: "c1" }, path: "/cleanups/c1/analytics", title: "title.event_analytics", parentView: "events", view: null },
  ],
  "host-analytics": [
    { entry: { kind: "host-analytics" }, path: "/host/analytics", title: "title.host_analytics", parentView: "events", view: null },
  ],
  "org-manage": [
    { entry: { kind: "org-manage", slug: "acme" }, path: "/orgs/acme/manage", title: "title.org_manage", parentView: "events", view: null },
  ],
} satisfies Record<DetailKind, RouteCase[]>

const VIEW_ROUTES: RouteCase[] = [
  { entry: { kind: "view", view: "map" }, path: "/map", title: "", parentView: null, view: "map" },
  { entry: { kind: "view", view: "search" }, path: "/search", title: "", parentView: null, view: "search" },
  { entry: { kind: "view", view: "report" }, path: "/report", title: "", parentView: null, view: "report" },
]

const ALL_CASES: RouteCase[] = [...Object.values(ROUTES).flat(), ...VIEW_ROUTES]
const ROUND_TRIP_CASES = ALL_CASES.filter((c) => c.parsed === undefined)
const ONE_WAY_CASES = ALL_CASES.filter((c) => c.parsed !== undefined)

const label = (c: RouteCase): string => JSON.stringify(c.entry)

describe("route table coverage", () => {
  it("has cases for exactly the declared detail kinds, so a new kind fails here until it is routed", () => {
    expect(Object.keys(ROUTES).sort()).toEqual([...ALL_DETAIL_KINDS].sort())
  })

  it("has cases for every view a detail entry can carry", () => {
    expect(VIEW_ROUTES.map((c) => c.entry.view)).toEqual(["map", "search", "report"])
  })
})

describe("entry -> path -> entry", () => {
  it.each(ROUND_TRIP_CASES.map((c) => [label(c), c] as const))(
    "%s round-trips through its canonical path",
    (_, c) => {
      expect(pathForEntry(c.entry)).toBe(c.path)
      expect(entryFromPath(c.path)).toEqual(c.entry)
      expect(entryIdentity(entryFromPath(c.path))).toBe(entryIdentity(c.entry))
    },
  )

  it.each(ONE_WAY_CASES.map((c) => [label(c), c] as const))(
    "%s has no address of its own and parses back as a different entry",
    (_, c) => {
      expect(pathForEntry(c.entry)).toBe(c.path)
      expect(entryFromPath(c.path)).toEqual(c.parsed)
    },
  )

  it("ignores non-identity fields when building a path", () => {
    for (const c of ROUND_TRIP_CASES) {
      const decorated: DetailEntry = {
        ...c.entry,
        title: "Decorated",
        lat: 1,
        lng: 2,
        profileTab: "hours",
        jumpToMessageId: "m9",
        reports: TWO_REPORTS,
      }
      expect(pathForEntry(decorated), label(c)).toBe(c.path)
      expect(entryFromPath(pathForEntry(decorated)), label(c)).toEqual(c.entry)
    }
  })
})

describe("path -> entry -> path", () => {
  const canonicalPaths = [...new Set(ROUND_TRIP_CASES.map((c) => c.path)), "/"]

  it.each(canonicalPaths)("%s is reproduced exactly", (path) => {
    expect(pathForEntry(entryFromPath(path))).toBe(path)
  })
})

describe("path aliases and fallbacks", () => {
  const ALIASES: [string | null | undefined, DetailEntry | null][] = [
    [null, null],
    [undefined, null],
    ["", null],
    ["/", null],
    ["/_", null],
    ["/unknown", null],
    ["/events", { kind: "cleanups" }],
    ["/e/x", { kind: "cleanup", id: "x" }],
    ["/e", null],
    ["/reports/x", { kind: "pin", id: "x" }],
    ["/reports", { kind: "myreports" }],
    ["/pin", null],
    ["/cleanups/e1/nonsense", { kind: "cleanup", id: "e1" }],
    ["/host/nonsense", { kind: "create-cleanup" }],
    ["/settings/nope", null],
    ["/groups", null],
    ["/groups/abc", null],
    ["/groups/new/info", { kind: "new-group" }],
    ["/channels", null],
    ["/channels/x", null],
    ["/messages/pins/bogus/x", { kind: "messages" }],
    ["/messages/pins/dm", { kind: "messages" }],
    ["/messages/members/bogus/x", { kind: "messages" }],
    ["/messages/members/dm", { kind: "messages" }],
    ["/messages/pins-room-id", { kind: "thread", id: "pins-room-id", roomKind: "cleanup" }],
    ["/messages/dm", { kind: "messages" }],
    ["/messages/report", { kind: "messages" }],
    ["/messages/group", { kind: "messages" }],
    ["/orgs", null],
    ["/orgs/acme/other", { kind: "org", slug: "acme" }],
    ["/people/u1/other", { kind: "person", id: "u1" }],
    ["/leaderboard", null],
    ["/post", null],
    ["/post/p1/other", { kind: "post", id: "p1" }],
    ["/compose/quote", { kind: "composer" }],
    ["/compose/other/p1", { kind: "composer" }],
    ["/notifications/other", { kind: "activity" }],
    ["/profile/other", { kind: "profile" }],
    ["/dashboard/other", { kind: "event-dashboard" }],
    ["/saves/other", { kind: "saves" }],
    ["/map/other", { kind: "view", view: "map" }],
    ["/_/pin/p1", { kind: "pin", id: "p1" }],
    ["/pin/p1/", { kind: "pin", id: "p1" }],
    ["/pin/p1?q=park", { kind: "pin", id: "p1" }],
    ["/pin/p1#h", { kind: "pin", id: "p1" }],
    ["/search?q=park", { kind: "view", view: "search" }],
  ]

  it.each(ALIASES)("%s parses to %j", (path, entry) => {
    expect(entryFromPath(path)).toEqual(entry)
  })

  const FALLBACKS: [DetailEntry | null, string][] = [
    [null, "/"],
    [{ kind: "view" }, "/"],
    [{ kind: "pin" }, "/"],
    [{ kind: "cleanup" }, "/cleanups"],
    [{ kind: "edit-cleanup" }, "/cleanups"],
    [{ kind: "host-mode" }, "/cleanups"],
    [{ kind: "host-checkin" }, "/cleanups"],
    [{ kind: "host-announce" }, "/cleanups"],
    [{ kind: "host-team" }, "/cleanups"],
    [{ kind: "host-log-hours" }, "/cleanups"],
    [{ kind: "event-analytics" }, "/cleanups"],
    [{ kind: "announcements" }, "/cleanups"],
    [{ kind: "announcement" }, "/cleanups"],
    [{ kind: "announcement", id: "c1" }, "/cleanups/c1/announcements"],
    [{ kind: "my-ticket" }, "/cleanups"],
    [{ kind: "org" }, "/"],
    [{ kind: "org-manage" }, "/"],
    [{ kind: "person" }, "/people"],
    [{ kind: "followers" }, "/people"],
    [{ kind: "following" }, "/people"],
    [{ kind: "leaderboard" }, "/"],
    [{ kind: "thread" }, "/messages"],
    [{ kind: "thread", id: "x" }, "/messages/x"],
    [{ kind: "pinned-messages" }, "/messages"],
    [{ kind: "pinned-messages", id: "x" }, "/messages/pins/cleanup/x"],
    [{ kind: "members" }, "/messages"],
    [{ kind: "members", id: "x" }, "/messages/members/cleanup/x"],
    [{ kind: "group-info" }, "/messages"],
    [{ kind: "post" }, "/"],
    [{ kind: "post-thread" }, "/"],
    [{ kind: "composer", composerMode: "quote" }, "/compose"],
    [{ kind: "composer", composerMode: "reply", targetPostId: "p1" }, "/compose"],
    [{ kind: "drop-pin" }, "/map"],
  ]

  it.each(FALLBACKS)("%j with missing params falls back to %s", (entry, path) => {
    expect(pathForEntry(entry)).toBe(path)
  })
})

describe("titles and views per kind", () => {
  it.each(ALL_CASES.map((c) => [label(c), c] as const))("%s", (_, c) => {
    expect(titleForEntry(c.entry)).toBe(c.title)
    expect(parentViewForEntry(c.entry)).toBe(c.parentView)
    expect(viewForEntry(c.entry)).toBe(c.view)
  })

  it("has no title, parent or view for a missing entry", () => {
    expect(titleForEntry(null)).toBe("")
    expect(parentViewForEntry(null)).toBeNull()
    expect(viewForEntry(null)).toBeNull()
  })

  it("passes a count param only for clusters", () => {
    expect(titleParamsForEntry({ kind: "cluster", reports: TWO_REPORTS })).toEqual({ count: 2 })
    expect(titleParamsForEntry({ kind: "cluster" })).toEqual({ count: 0 })
    for (const c of ALL_CASES.filter((c) => c.entry.kind !== "cluster")) {
      expect(titleParamsForEntry(c.entry), label(c)).toEqual({})
    }
    expect(titleParamsForEntry(null)).toEqual({})
  })
})

describe("routes.ts stays loadable on its own", () => {
  // The mobile tests transpile routes.ts in isolation and import it from a data: URL, which has no
  // module graph to resolve against: any runtime import would break them.
  it("transpiles to a module with no runtime imports", () => {
    const source = readFileSync(new URL("../routes.ts", import.meta.url), "utf8")
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    })
    expect(outputText).not.toMatch(/^\s*import\b/m)
    expect(outputText).not.toMatch(/\bimport\s*\(/)
    expect(outputText).not.toMatch(/^\s*export\s[^;]*\bfrom\b/m)
  })
})
