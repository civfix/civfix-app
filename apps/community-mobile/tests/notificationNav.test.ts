import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { isInternalLink } from "../src/lib/links.ts"
import { bridgeKey, nativeBridgeKey, BRIDGE_ROUTE_NAMES } from "../src/lib/navBridge.ts"
import { shellHostsEntries } from "../src/lib/internalHref.ts"

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
  "/orgs/acme",
  "/me/donations",
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
  assert.match(body, /bridgeFocused: key !== null && key === nativeBridgeKey\(readFocusedRoute\(\)\)/)
  assert.match(body, /shellFocused: shellHostsEntries\(readFocusedRoute\(\)\)/)
  assert.match(body, /activeKey: entryIdentity\(useNavStore\.getState\(\)\.active\)/)
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
    { entry: { kind: "org", slug: "acme" } as const, route: "orgs/[slug]" },
  ]
  for (const { entry, route } of SHELL_HOSTED) {
    assert.equal(bridgeKey(entry), null, `${entry.kind} still claims a bridge key`)
    assert.equal(nativeBridgeKey({ name: route, params: { id: "c1", seatId: "s1", slug: "acme" } }), null, route)
    assert.equal(shellHostsEntries({ name: route }), true, route)
  }
})

test("a broadcast push that lands in the sheet claims no native bridge key", () => {
  assert.equal(bridgeKey({ kind: "host-broadcast-quick", id: "c1" }), null)
  assert.equal(bridgeKey({ kind: "my-donations" }), null)
  assert.equal(shellHostsEntries({ name: "compose" }), false)
})
