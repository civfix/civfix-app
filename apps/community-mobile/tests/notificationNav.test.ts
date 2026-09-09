import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { isInternalLink } from "../src/lib/links.ts"
import { bridgeKey, nativeBridgeKey, BRIDGE_ROUTE_NAMES } from "../src/lib/navBridge.ts"

const adapter = readFileSync(new URL("../src/components/MobileNavAdapter.tsx", import.meta.url), "utf8")

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

test("a tapped notification for the full-screen route already on top changes nothing at all", () => {
  const apply = adapter.slice(adapter.indexOf("export function applyInternalHref"))
  const body = apply.slice(0, apply.indexOf("\n}"))
  const guard = body.indexOf("key === readFocusedBridgeKey()")
  const apply2 = body.indexOf("navigateTo(entry")
  assert.ok(guard > -1 && apply2 > guard)
  assert.match(adapter, /readFocusedBridgeKey = focusedKey/)
  assert.match(adapter, /readFocusedBridgeKey = \(\) => null/)
})

test("the bridge asks the router which screen is actually on top before it pushes", () => {
  assert.match(adapter, /useNavigationContainerRef/)
  assert.match(adapter, /navigationRef\.isReady\(\) \? nativeBridgeKey\(navigationRef\.getCurrentRoute\(\)\) : null/)
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

test("an event push that names a full-screen host surface resolves to that screen's own key", () => {
  assert.equal(
    nativeBridgeKey({ name: BRIDGE_ROUTE_NAMES.hostCheckin, params: { id: "c1" } }),
    bridgeKey({ kind: "host-checkin", id: "c1" }),
  )
  assert.equal(
    nativeBridgeKey({ name: BRIDGE_ROUTE_NAMES.myTicket, params: { id: "c1", seatId: "s1" } }),
    bridgeKey({ kind: "my-ticket", id: "c1", seatId: "s1" }),
  )
  assert.equal(
    nativeBridgeKey({ name: BRIDGE_ROUTE_NAMES.org, params: { slug: "acme" } }),
    bridgeKey({ kind: "org", slug: "acme" }),
  )
})

test("a broadcast push that lands in the sheet claims no native bridge key", () => {
  assert.equal(bridgeKey({ kind: "host-broadcast-quick", id: "c1" }), null)
  assert.equal(bridgeKey({ kind: "my-donations" }), null)
})
