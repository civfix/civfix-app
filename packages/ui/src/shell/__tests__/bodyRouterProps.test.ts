import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { runInThisContext } from "node:vm"
import type { ReactElement } from "react"
import ts from "typescript"
import { describe, expect, it } from "vitest"
import type { DetailEntry, View } from "../../nav"
import * as bodyRoutes from "../bodyRoutes"
import { DETAIL_BODY, VIEW_BODY, type BodyId } from "../bodyRoutes"

// react-native's Flow-typed entry does not parse under the package's node vitest, so BodyRouter.tsx
// is compiled on its own and handed stand-ins for its RN and ../bodies imports. Each ../bodies export
// is a distinct stand-in named after that export, so element identity still pins WHICH body renders.

const realRequire = createRequire(import.meta.url)

function standIn(name: string): () => null {
  const component = () => null
  Object.defineProperty(component, "name", { value: name })
  return component
}

const bodyStandIns = new Map<string, () => null>()
function bodyExport(name: string): () => null {
  let component = bodyStandIns.get(name)
  if (!component) {
    component = standIn(name)
    bodyStandIns.set(name, component)
  }
  return component
}

const RNView = standIn("View")

const HARNESS_MODULES: Record<string, unknown> = {
  react: realRequire("react"),
  "react/jsx-runtime": realRequire("react/jsx-runtime"),
  "react-native": {
    View: RNView,
    StyleSheet: { create: <T,>(styles: T): T => styles, hairlineWidth: 1 },
  },
  "../theme": { makeThemedStyles: () => () => ({}), useTheme: () => ({ colors: {} }) },
  "../typography": { Text: standIn("Text") },
  "../surface": { BlurSurface: standIn("BlurSurface") },
  "../bodies": new Proxy(
    {},
    { get: (_, key) => (typeof key === "string" && key !== "__esModule" ? bodyExport(key) : undefined) },
  ),
  "./bodyRoutes": bodyRoutes,
}

type BodyRouterFn = (props: { entry: DetailEntry | null; view: View }) => ReactElement<{
  children: ReactElement<Record<string, unknown>>
}>

function loadBodyRouter(): BodyRouterFn {
  const source = readFileSync(new URL("../BodyRouter.tsx", import.meta.url), "utf8")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  })
  const moduleRecord: { exports: Record<string, unknown> } = { exports: {} }
  const harnessRequire = (specifier: string): unknown => {
    if (!(specifier in HARNESS_MODULES)) throw new Error(`BodyRouter harness has no stand-in for ${specifier}`)
    return HARNESS_MODULES[specifier]
  }
  const factory = runInThisContext(`(function (exports, require, module) {${outputText}\n})`) as (
    exports: Record<string, unknown>,
    require: (specifier: string) => unknown,
    module: { exports: Record<string, unknown> },
  ) => void
  factory(moduleRecord.exports, harnessRequire, moduleRecord)
  return moduleRecord.exports.BodyRouter as BodyRouterFn
}

const BodyRouter = loadBodyRouter()

const PEER = { id: "u2", name: "Ada" } as unknown as NonNullable<DetailEntry["peer"]>
const REPORTS = [{ id: "r1" }, { id: "r2" }] as unknown as NonNullable<DetailEntry["reports"]>
const EVENT = { id: "c9", title: "Beach day" } as unknown as NonNullable<DetailEntry["event"]>

const EVERY_FIELD: Omit<DetailEntry, "kind"> = {
  id: "x1",
  roomKind: "dm",
  peer: PEER,
  title: "Title",
  lat: 34.05,
  lng: -118.25,
  reportId: "r9",
  reports: REPORTS,
  event: EVENT,
  geoid: "06037",
  jumpToMessageId: "m1",
  composerMode: "quote",
  targetPostId: "p1",
  profileTab: "hours",
  slug: "acme",
  seatId: "s1",
  announcementId: "a1",
}

const full = (kind: DetailEntry["kind"]): DetailEntry => ({ kind, ...EVERY_FIELD })

type BodyCase = {
  entry: DetailEntry | null
  view?: View
  /** A `../bodies` export name, "View" for the react-native View, or "Stub" for BodyRouter's own placeholder. */
  renders: string
  props: Record<string, unknown>
}

const BODY_CASES = {
  feed: [{ entry: null, view: "home", renders: "FeedBody", props: {} }],
  events: [
    { entry: null, view: "events", renders: "EventsBody", props: {} },
    { entry: full("cleanups"), renders: "EventsBody", props: {} },
  ],
  messagingList: [
    { entry: null, view: "messaging", renders: "MessagingListBody", props: {} },
    { entry: full("messages"), renders: "MessagingListBody", props: {} },
  ],
  social: [
    { entry: null, view: "social", renders: "SocialBody", props: {} },
    { entry: full("people"), renders: "SocialBody", props: {} },
    { entry: { kind: "view" }, view: "social", renders: "SocialBody", props: {} },
  ],
  reports: [
    { entry: null, view: "reports", renders: "ReportsBody", props: {} },
    { entry: full("myreports"), renders: "ReportsBody", props: {} },
  ],
  personDetail: [
    { entry: full("person"), renders: "PersonDetailBody", props: { id: "x1" } },
    { entry: { kind: "person" }, renders: "PersonDetailBody", props: { id: "" } },
  ],
  profile: [{ entry: full("profile"), renders: "ProfileBody", props: {} }],
  reportDetail: [
    { entry: full("pin"), renders: "ReportDetailBody", props: { id: "x1" } },
    { entry: { kind: "pin" }, renders: "ReportDetailBody", props: { id: "" } },
  ],
  eventDetail: [
    { entry: full("cleanup"), renders: "EventDetailBody", props: { id: "x1" } },
    { entry: { kind: "cleanup" }, renders: "EventDetailBody", props: { id: "" } },
  ],
  createCleanup: [{ entry: full("create-cleanup"), renders: "CreateCleanupBody", props: {} }],
  editCleanup: [
    { entry: full("edit-cleanup"), renders: "EditCleanupBody", props: { id: "x1" } },
    { entry: { kind: "edit-cleanup" }, renders: "EditCleanupBody", props: { id: "" } },
  ],
  notifications: [{ entry: full("activity"), renders: "NotificationsBody", props: {} }],
  notificationPrefs: [{ entry: full("notification-prefs"), renders: "NotificationPrefsBody", props: {} }],
  conversation: [
    {
      entry: full("thread"),
      renders: "ConversationBody",
      props: { id: "x1", roomKind: "dm", peer: PEER, jumpToMessageId: "m1" },
    },
    { entry: { kind: "thread" }, renders: "ConversationBody", props: { id: "", roomKind: "cleanup" } },
  ],
  pinnedMessages: [
    {
      entry: full("pinned-messages"),
      renders: "ConversationBody",
      props: { id: "x1", roomKind: "dm", pinnedOnly: true },
    },
    {
      entry: { kind: "pinned-messages" },
      renders: "ConversationBody",
      props: { id: "", roomKind: "cleanup", pinnedOnly: true },
    },
  ],
  newGroup: [{ entry: full("new-group"), renders: "NewGroupBody", props: {} }],
  newChannel: [{ entry: full("new-channel"), renders: "NewChannelBody", props: {} }],
  groupInfo: [
    { entry: full("group-info"), renders: "GroupInfoBody", props: { id: "x1" } },
    { entry: { kind: "group-info" }, renders: "GroupInfoBody", props: { id: "" } },
  ],
  reportFlow: [
    { entry: null, view: "report", renders: "ReportFlowBody", props: {} },
    { entry: { kind: "view", view: "report" }, view: "home", renders: "ReportFlowBody", props: {} },
  ],
  clusterReports: [
    { entry: full("cluster"), renders: "ClusterReportsBody", props: { reports: REPORTS, event: EVENT } },
    { entry: { kind: "cluster" }, renders: "ClusterReportsBody", props: { reports: [], event: null } },
    { entry: full("blend"), renders: "ClusterReportsBody", props: { reports: REPORTS, event: EVENT } },
    { entry: { kind: "blend" }, renders: "ClusterReportsBody", props: { reports: [], event: null } },
  ],
  connections: [
    { entry: full("followers"), renders: "ConnectionsBody", props: { id: "x1", mode: "followers" } },
    { entry: full("following"), renders: "ConnectionsBody", props: { id: "x1", mode: "following" } },
    { entry: { kind: "followers" }, renders: "ConnectionsBody", props: { id: "", mode: "followers" } },
    { entry: { kind: "following" }, renders: "ConnectionsBody", props: { id: "", mode: "following" } },
  ],
  leaderboard: [
    { entry: full("leaderboard"), renders: "LeaderboardBody", props: { geoid: "06037" } },
    { entry: { kind: "leaderboard" }, renders: "LeaderboardBody", props: { geoid: "" } },
  ],
  members: [
    { entry: full("members"), renders: "MembersBody", props: { id: "x1", roomKind: "dm" } },
    { entry: { kind: "members" }, renders: "MembersBody", props: { id: "", roomKind: "cleanup" } },
  ],
  blockedAccounts: [{ entry: full("blocked"), renders: "BlockedAccountsBody", props: {} }],
  languageSettings: [{ entry: full("language-settings"), renders: "LanguageSettingsBody", props: {} }],
  appearanceSettings: [{ entry: full("appearance-settings"), renders: "AppearanceSettingsBody", props: {} }],
  settings: [{ entry: full("settings"), renders: "SettingsBody", props: {} }],
  settingsAccount: [{ entry: full("settings-account"), renders: "SettingsAccountBody", props: {} }],
  settingsPrivacy: [{ entry: full("settings-privacy"), renders: "SettingsPrivacyBody", props: {} }],
  mapView: [
    { entry: null, view: "map", renders: "View", props: { style: { flex: 1 } } },
    { entry: { kind: "view", view: "map" }, view: "home", renders: "View", props: { style: { flex: 1 } } },
  ],
  search: [
    { entry: null, view: "search", renders: "SearchBody", props: {} },
    { entry: { kind: "view", view: "search" }, view: "home", renders: "SearchBody", props: {} },
  ],
  post: [
    { entry: full("post"), renders: "PostDetailBody", props: { id: "x1" } },
    { entry: { kind: "post" }, renders: "PostDetailBody", props: { id: "" } },
  ],
  postThread: [
    { entry: full("post-thread"), renders: "PostThreadBody", props: { id: "x1" } },
    { entry: { kind: "post-thread" }, renders: "PostThreadBody", props: { id: "" } },
  ],
  postComposer: [
    { entry: full("composer"), renders: "PostComposer", props: { mode: "quote", targetPostId: "p1" } },
    { entry: { kind: "composer" }, renders: "PostComposer", props: { mode: "post", targetPostId: undefined } },
  ],
  saves: [{ entry: full("saves"), renders: "SavedPostsBody", props: {} }],
  dropPin: [
    { entry: full("drop-pin"), renders: "DropPinBody", props: { lat: 34.05, lng: -118.25 } },
    { entry: { kind: "drop-pin" }, renders: "DropPinBody", props: { lat: null, lng: null } },
  ],
  hostMode: [
    { entry: full("host-mode"), renders: "HostModeBody", props: { id: "x1" } },
    { entry: { kind: "host-mode" }, renders: "HostModeBody", props: { id: "" } },
  ],
  hostCheckin: [
    { entry: full("host-checkin"), renders: "HostCheckinBody", props: { id: "x1" } },
    { entry: { kind: "host-checkin" }, renders: "HostCheckinBody", props: { id: "" } },
  ],
  hostAnnounce: [
    { entry: full("host-announce"), renders: "HostAnnounceBody", props: { id: "x1" } },
    { entry: { kind: "host-announce" }, renders: "HostAnnounceBody", props: { id: "" } },
  ],
  hostTeam: [
    { entry: full("host-team"), renders: "HostTeamBody", props: { id: "x1" } },
    { entry: { kind: "host-team" }, renders: "HostTeamBody", props: { id: "" } },
  ],
  hostLogHours: [
    { entry: full("host-log-hours"), renders: "HostLogHoursBody", props: { id: "x1" } },
    { entry: { kind: "host-log-hours" }, renders: "HostLogHoursBody", props: { id: "" } },
  ],
  myTicket: [
    { entry: full("my-ticket"), renders: "MyTicketBody", props: { id: "x1", seatId: "s1" } },
    { entry: { kind: "my-ticket" }, renders: "MyTicketBody", props: { id: "" } },
  ],
  orgPage: [
    { entry: full("org"), renders: "OrgPageBody", props: { slug: "acme" } },
    { entry: { kind: "org" }, renders: "OrgPageBody", props: { slug: "" } },
  ],
  orgManage: [
    { entry: full("org-manage"), renders: "OrgManageBody", props: { slug: "acme" } },
    { entry: { kind: "org-manage" }, renders: "OrgManageBody", props: { slug: "" } },
  ],
  eventDashboard: [{ entry: full("event-dashboard"), renders: "EventDashboardBody", props: {} }],
  eventAnalytics: [
    { entry: full("event-analytics"), renders: "EventAnalyticsBody", props: { id: "x1" } },
    { entry: { kind: "event-analytics" }, renders: "EventAnalyticsBody", props: { id: "" } },
    { entry: full("host-analytics"), renders: "EventAnalyticsBody", props: { id: "x1" } },
    { entry: { kind: "host-analytics" }, renders: "EventAnalyticsBody", props: { id: "" } },
  ],
  announcement: [
    { entry: full("announcement"), renders: "AnnouncementBody", props: { id: "x1", announcementId: "a1" } },
    { entry: { kind: "announcement" }, renders: "AnnouncementBody", props: { id: "", announcementId: "" } },
  ],
  announcements: [
    { entry: full("announcements"), renders: "AnnouncementsBody", props: { id: "x1" } },
    { entry: { kind: "announcements" }, renders: "AnnouncementsBody", props: { id: "" } },
  ],
  stub: [
    { entry: full("new-msg"), renders: "Stub", props: { label: "new-msg #x1" } },
    { entry: { kind: "new-msg" }, renders: "Stub", props: { label: "new-msg" } },
  ],
} satisfies Record<BodyId, BodyCase[]>

function routedBodyId(c: BodyCase): BodyId {
  const view = c.view ?? "home"
  if (!c.entry) return VIEW_BODY[view]
  return c.entry.kind === "view" ? VIEW_BODY[c.entry.view ?? view] : DETAIL_BODY[c.entry.kind]
}

function expectedType(renders: string): unknown {
  return renders === "View" ? RNView : bodyExport(renders)
}

const CASES = (Object.entries(BODY_CASES) as [BodyId, BodyCase[]][]).flatMap(([bodyId, cases]) =>
  cases.map((c) => [`${bodyId} <- ${c.entry ? JSON.stringify({ kind: c.entry.kind, view: c.entry.view }) : `view ${c.view}`}`, bodyId, c] as const),
)

describe("BodyRouter body table", () => {
  it("covers exactly the body ids the routing tables produce", () => {
    const routed = new Set<string>([...Object.values(VIEW_BODY), ...Object.values(DETAIL_BODY)])
    expect(Object.keys(BODY_CASES).sort()).toEqual([...routed].sort())
  })

  it("exercises every view and every detail kind at least once", () => {
    const all = Object.values(BODY_CASES).flat() as BodyCase[]
    const kinds = new Set(all.flatMap((c) => (c.entry && c.entry.kind !== "view" ? [c.entry.kind] : [])))
    const views = new Set(all.flatMap((c) => (c.entry ? [] : [c.view])))
    expect([...kinds].sort()).toEqual(Object.keys(DETAIL_BODY).sort())
    expect([...views].sort()).toEqual(Object.keys(VIEW_BODY).sort())
  })

  it.each(CASES)("%s", (_, bodyId, c) => {
    expect(routedBodyId(c)).toBe(bodyId)
    const body = BodyRouter({ entry: c.entry, view: c.view ?? "home" }).props.children
    if (c.renders === "Stub") {
      expect((body.type as { name: string }).name).toBe("Stub")
    } else {
      expect(body.type).toBe(expectedType(c.renders))
    }
    expect(body.props).toStrictEqual(c.props)
  })
})
