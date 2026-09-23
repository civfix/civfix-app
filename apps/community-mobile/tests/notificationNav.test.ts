import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { isInternalLink } from "../src/lib/links.ts"
import { bridgeKey, nativeBridgeKey, BRIDGE_ROUTE_NAMES } from "../src/lib/navBridge.ts"
import { shellHostsEntries } from "../src/lib/internalHref.ts"
import { threadEntryRoute } from "../src/lib/threadEntryRoutes.ts"

const adapter = readFileSync(new URL("../src/components/MobileNavAdapter.tsx", import.meta.url), "utf8")
const layout = readFileSync(new URL("../app/_layout.tsx", import.meta.url), "utf8")

const NOTIFICATION_LINKS = [
  "/messages/dm/room-1",
  "/messages/report/room-2",
  "/messages/group/room-3",
  "/cleanups/c1",
  "/cleanups/c1/host",
  "/cleanups/c1/checkin",
  "/cleanups/c1/ticket",
  "/cleanups/c1/ticket/s1",
  "/cleanups/c1/announcements",
  "/cleanups/c1/announcements/a1",
  "/cleanups/c1/analytics",
  "/orgs/acme",
  "/orgs/acme/manage",
  "/people/u1",
  "/post/p1",
  "/reports",
  "/notifications",
]

test("every link the API puts on a notification survives the allowlist", () => {
  for (const link of NOTIFICATION_LINKS) {
    assert.equal(isInternalLink(link), true, `${link} is not allowlisted`)
  }
})

test("a tapped notification applies its href through the dedup verb, never a bare re-seed", () => {
  const apply = adapter.slice(adapter.indexOf("export function applyInternalHref"))
  const body = apply.slice(0, apply.indexOf("\n}"))
  assert.match(body, /navigateTo\(entry, "compact"\)/)
  assert.doesNotMatch(body, /seedEntry\(|\.seed\(/)
})

test("a tapped notification decides through the one action model before it touches the store", () => {
  const apply = adapter.slice(adapter.indexOf("export function applyInternalHref"))
  const body = apply.slice(0, apply.indexOf("\n}"))
  const decided = body.indexOf("internalHrefAction({")
  const applied = body.indexOf('if (action !== "none")')
  assert.ok(decided > -1 && applied > decided)
  assert.match(body, /const focused = readFocusedRoute\(\)/)
  assert.match(body, /bridgeFocused: key !== null && key === nativeBridgeKey\(focused\)/)
  assert.match(body, /shellFocused: shellHostsEntries\(focused\)/)
  assert.match(body, /activeKey: entryIdentity\(useNavStore\.getState\(\)\.active\)/)
})

test("an entity link tapped on a full-screen route is pushed on top of it, never dismissed", () => {
  const apply = adapter.slice(adapter.indexOf("export function applyInternalHref"))
  const body = apply.slice(0, apply.indexOf("\n}"))
  assert.match(body, /const detailRoute = threadEntryRoute\(entry\)/)
  assert.match(body, /routeFocused: focused !== null && pushDetailRoute !== null/)
  assert.match(body, /detailRoute: detailRoute !== null/)
  const pushed = body.indexOf('if (action === "push-route"')
  const dismissed = body.indexOf('dismissToShell: action === "navigate-and-dismiss"')
  assert.ok(pushed > -1 && dismissed > pushed)
  assert.match(body, /pushDetailRoute\(detailRoute\)/)
  assert.ok(
    adapter.includes("router.push({ pathname: route.pathname as never, params: route.params })"),
  )
  assert.match(adapter, /pushDetailRoute = null/)
})

test("a tapped notification dismisses to the shell whenever the action says to", () => {
  const listener = layout.slice(layout.indexOf("function useNotificationDeepLinks"))
  const body = listener.slice(0, listener.indexOf("\n}"))
  assert.match(body, /const applied = applyInternalHref\(href as string\)/)
  assert.match(body, /if \(applied\?\.dismissToShell\) dismissToShell\?\.\(\)/)
})

test("the bridge asks the router which screen is actually on top before it pushes", () => {
  assert.match(adapter, /useNavigationContainerRef/)
  assert.match(
    adapter,
    /navigationRef\.isReady\(\) \? \(navigationRef\.getCurrentRoute\(\) \?\? null\) : null/,
  )
  assert.match(adapter, /const focusedKey = \(\): string \| null => nativeBridgeKey\(focusedRoute\(\)\)/)
  assert.match(adapter, /readFocusedRoute = focusedRoute/)
  assert.match(adapter, /readFocusedRoute = \(\) => null/)
  assert.match(adapter, /bridgeDecision\(active, bridgeGuard, Date\.now\(\), focusedKey\(\)\)/)
})

test("the strip and the push stay synchronous inside the store notification", () => {
  const decide = adapter.slice(adapter.indexOf("const decide ="), adapter.indexOf("decide(useNavStore.getState().active)"))
  assert.doesNotMatch(decide, /queueMicrotask|setTimeout|Promise\.resolve|requestAnimationFrame/)
  const strip = decide.indexOf("setStack(stack)")
  const push = decide.indexOf("router.push(route)")
  assert.ok(strip > -1 && push > strip)
})

test("a DM notification for the room already on screen resolves to the key of that screen", () => {
  const roomId = "room-1"
  assert.equal(isInternalLink(`/messages/dm/${roomId}`), true)
  assert.equal(
    nativeBridgeKey({ name: BRIDGE_ROUTE_NAMES.thread, params: { id: roomId, roomKind: "dm" } }),
    bridgeKey({ kind: "thread", id: roomId, roomKind: "dm" }),
  )
})

test("a shell notification target never claims a native bridge key", () => {
  assert.equal(bridgeKey({ kind: "activity" }), null)
  assert.equal(bridgeKey({ kind: "pin", id: "r1" }), null)
  assert.equal(nativeBridgeKey({ name: "notifications/index" }), null)
})

test("an event push that names a host surface lands in a shell, not on a native route of its own", () => {
  const SHELL_HOSTED = [
    { entry: { kind: "host-mode", id: "c1" } as const, route: "cleanups/[id]/host" },
    { entry: { kind: "host-checkin", id: "c1" } as const, route: "cleanups/[id]/checkin" },
    { entry: { kind: "host-team", id: "c1" } as const, route: "cleanups/[id]/team" },
    { entry: { kind: "host-log-hours", id: "c1" } as const, route: "cleanups/[id]/hours" },
    { entry: { kind: "my-ticket", id: "c1", seatId: "s1" } as const, route: "cleanups/[id]/ticket/[seatId]" },
    { entry: { kind: "event-analytics", id: "c1" } as const, route: "cleanups/[id]/analytics" },
    { entry: { kind: "announcements", id: "c1" } as const, route: "cleanups/[id]/announcements" },
    {
      entry: { kind: "announcement", id: "c1", announcementId: "a1" } as const,
      route: "cleanups/[id]/announcements/[announcementId]",
    },
    { entry: { kind: "org", slug: "acme" } as const, route: "orgs/[slug]/index" },
    { entry: { kind: "org-manage", slug: "acme" } as const, route: "orgs/[slug]/manage" },
  ]
  for (const { entry, route } of SHELL_HOSTED) {
    assert.equal(bridgeKey(entry), null, `${entry.kind} still claims a bridge key`)
    assert.equal(
      nativeBridgeKey({
        name: route,
        params: { id: "c1", seatId: "s1", slug: "acme", announcementId: "a1" },
      }),
      null,
      route,
    )
    assert.equal(shellHostsEntries({ name: route }), true, route)
  }
})

test("those same shell surfaces are push-capable, so a tap from inside a thread stacks", () => {
  const PUSHABLE = [
    { entry: { kind: "announcements", id: "c1" } as const, pathname: "/cleanups/[id]/announcements" },
    {
      entry: { kind: "announcement", id: "c1", announcementId: "a1" } as const,
      pathname: "/cleanups/[id]/announcements/[announcementId]",
    },
    { entry: { kind: "event-analytics", id: "c1" } as const, pathname: "/cleanups/[id]/analytics" },
    { entry: { kind: "org-manage", slug: "acme" } as const, pathname: "/orgs/[slug]/manage" },
  ]
  for (const { entry, pathname } of PUSHABLE) {
    const route = threadEntryRoute(entry)
    assert.notEqual(route, null, `${entry.kind} still tears the stack down`)
    assert.equal(route!.pathname, pathname)
    assert.equal(shellHostsEntries({ name: pathname.replace(/^\//, "") }), true, pathname)
  }
})

test("the announcement composer lands in the sheet and claims no native bridge key", () => {
  assert.equal(bridgeKey({ kind: "host-announce", id: "c1" }), null)
  assert.equal(shellHostsEntries({ name: "compose" }), false)
})
