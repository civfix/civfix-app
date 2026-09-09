import assert from "node:assert/strict"
import { test } from "node:test"
import type { DetailEntry } from "@civfix/ui"
import {
  BRIDGE_REPEAT_WINDOW_MS,
  BRIDGE_ROUTE_NAMES,
  MY_TICKET_ROUTE_NAMES,
  SHELL_HOSTED_BRIDGE_KINDS,
  INITIAL_BRIDGE_GUARD,
  bridgeDecision,
  bridgeKey,
  bridgeRoute,
  nativeBridgeKey,
  stackWithoutBridged,
  stackWithoutShellHosted,
  type BridgeGuard,
} from "./navBridge.ts"

const thread = (id: string): DetailEntry => ({ kind: "thread", id, roomKind: "cleanup" })
const postThread = (id: string): DetailEntry => ({ kind: "post-thread", id })
const composer = (mode?: "post" | "quote" | "reply", targetPostId?: string): DetailEntry => ({
  kind: "composer",
  ...(mode ? { composerMode: mode } : {}),
  ...(targetPostId ? { targetPostId } : {}),
})
const hostMode = (id: string): DetailEntry => ({ kind: "host-mode", id })
const hostCheckin = (id: string): DetailEntry => ({ kind: "host-checkin", id })
const myTicket = (id: string, seatId?: string): DetailEntry => ({
  kind: "my-ticket",
  id,
  ...(seatId ? { seatId } : {}),
})
const org = (slug: string): DetailEntry => ({ kind: "org", slug })

interface Step {
  active: DetailEntry | null
  now: number
  focused?: string | null
}

function run(steps: Step[], start: BridgeGuard = INITIAL_BRIDGE_GUARD) {
  let guard = start
  const actions = steps.map((step) => {
    const decision = bridgeDecision(step.active, guard, step.now, step.focused ?? null)
    guard = decision.guard
    return decision.action
  })
  return { actions, guard }
}

test("only the full-screen kinds have a bridge key", () => {
  assert.equal(bridgeKey(null), null)
  assert.equal(bridgeKey({ kind: "pin", id: "r1" }), null)
  assert.equal(bridgeKey({ kind: "person", id: "p1" }), null)
  assert.equal(bridgeKey({ kind: "cleanup", id: "c1" }), null)
  assert.equal(bridgeKey(hostMode("c1")), "host-mode:c1")
  assert.equal(bridgeKey(hostCheckin("c1")), "host-checkin:c1")
  assert.equal(bridgeKey(myTicket("c1")), "my-ticket:c1:")
  assert.equal(bridgeKey(myTicket("c1", "s1")), "my-ticket:c1:s1")
  assert.equal(bridgeKey(org("acme")), "org:acme")
  assert.equal(bridgeKey(thread("room-1")), "thread:room-1")
  assert.equal(bridgeKey(postThread("post-1")), "post-thread:post-1")
  assert.equal(bridgeKey(composer()), "composer:post:")
  assert.equal(bridgeKey(composer("reply", "post-9")), "composer:reply:post-9")
})

test("an id-less thread or post-thread entry is never bridged", () => {
  assert.equal(bridgeKey({ kind: "thread" }), null)
  assert.equal(bridgeKey({ kind: "post-thread" }), null)
  const { actions } = run([{ active: { kind: "thread" }, now: 0 }])
  assert.equal(actions[0].type, "none")
})

test("a thread carries its room kind and DM peer across the param boundary", () => {
  const route = bridgeRoute({
    kind: "thread",
    id: "room-7",
    roomKind: "dm",
    peer: { id: "u1", name: "Ada", handle: "ada" } as DetailEntry["peer"],
  })
  assert.deepEqual(route, {
    pathname: "/messages/[id]",
    params: { id: "room-7", roomKind: "dm", peerId: "u1", peerName: "Ada", peerHandle: "ada" },
  })
})

test("a thread with no explicit room kind defaults to cleanup", () => {
  assert.deepEqual(bridgeRoute({ kind: "thread", id: "room-7" }), {
    pathname: "/messages/[id]",
    params: { id: "room-7", roomKind: "cleanup" },
  })
})

test("opening a thread bridges once and the store entry is dropped", () => {
  const { actions } = run([{ active: thread("A"), now: 1000 }])
  assert.deepEqual(actions[0], {
    type: "bridge",
    key: "thread:A",
    route: { pathname: "/messages/[id]", params: { id: "A", roomKind: "cleanup" } },
  })
})

test("the re-entrant pop the bridge itself causes does NOT re-arm the guard into a second push", () => {
  const { actions, guard } = run([
    { active: thread("A"), now: 1000 },
    { active: null, now: 1000 },
    { active: thread("A"), now: 1000 },
  ])
  assert.equal(actions[0].type, "bridge")
  assert.equal(actions[1].type, "none")
  assert.equal(actions[2].type, "drop")
  assert.equal(guard.recentKey, "thread:A")
})

test("a double tap on the same row within the repeat window drops the duplicate instead of pushing twice", () => {
  const { actions } = run([
    { active: thread("A"), now: 0 },
    { active: null, now: 0 },
    { active: thread("A"), now: 250 },
    { active: null, now: 250 },
  ])
  assert.deepEqual(
    actions.map((a) => a.type),
    ["bridge", "none", "drop", "none"],
  )
})

test("the window is a DOUBLE-TAP window, so backing out and re-tapping the row bridges again", () => {
  const { actions } = run([
    { active: thread("A"), now: 0 },
    { active: null, now: 0 },
    { active: thread("A"), now: 400 },
  ])
  assert.equal(actions[0].type, "bridge")
  assert.equal(actions[2].type, "bridge")
  assert.ok(BRIDGE_REPEAT_WINDOW_MS <= 300)
})

test("re-opening the same thread after the window bridges again", () => {
  const { actions } = run([
    { active: thread("A"), now: 0 },
    { active: null, now: 0 },
    { active: thread("A"), now: BRIDGE_REPEAT_WINDOW_MS },
  ])
  assert.equal(actions[0].type, "bridge")
  assert.equal(actions[2].type, "bridge")
})

test("open A, close, reopen A is the sequence the old id guard broke - both opens bridge", () => {
  const { actions } = run([
    { active: thread("A"), now: 0 },
    { active: null, now: 0 },
    { active: thread("A"), now: 5000 },
    { active: null, now: 5000 },
  ])
  assert.equal(actions[0].type, "bridge")
  assert.equal(actions[2].type, "bridge")
})

test("a different room right after the first still bridges - the window is per target", () => {
  const { actions } = run([
    { active: thread("A"), now: 0 },
    { active: null, now: 0 },
    { active: thread("B"), now: 60 },
  ])
  assert.equal(actions[0].type, "bridge")
  assert.equal(actions[2].type, "bridge")
  assert.equal((actions[2] as { key: string }).key, "thread:B")
})

test("a notification that does not change the active entry never bridges twice", () => {
  const { actions } = run([
    { active: thread("A"), now: 0 },
    { active: thread("A"), now: 0 },
    { active: thread("A"), now: 5 },
  ])
  assert.deepEqual(
    actions.map((a) => a.type),
    ["bridge", "none", "none"],
  )
})

test("post-thread and composer follow the same open/close/reopen rules as thread", () => {
  const post = run([
    { active: postThread("P"), now: 0 },
    { active: null, now: 0 },
    { active: postThread("P"), now: 100 },
    { active: null, now: 100 },
    { active: postThread("P"), now: 4000 },
  ])
  assert.deepEqual(
    post.actions.map((a) => a.type),
    ["bridge", "none", "drop", "none", "bridge"],
  )

  const compose = run([
    { active: composer("post"), now: 0 },
    { active: null, now: 0 },
    { active: composer("post"), now: 100 },
    { active: null, now: 100 },
    { active: composer("reply", "P1"), now: 120 },
  ])
  assert.deepEqual(
    compose.actions.map((a) => a.type),
    ["bridge", "none", "drop", "none", "bridge"],
  )
})

test("a non-bridged kind becoming active clears the open latch without erasing the repeat window", () => {
  const { actions, guard } = run([
    { active: thread("A"), now: 0 },
    { active: { kind: "pin", id: "r1" }, now: 10 },
    { active: thread("A"), now: 20 },
  ])
  assert.equal(actions[0].type, "bridge")
  assert.equal(actions[1].type, "none")
  assert.equal(actions[2].type, "drop")
  assert.equal(guard.openKey, "thread:A")
})

test("every bridged route reads its own name back as the key that produced it", () => {
  assert.equal(bridgeRoute(thread("A"))?.pathname, `/${BRIDGE_ROUTE_NAMES.thread}`)
  assert.equal(bridgeRoute(postThread("P"))?.pathname, `/${BRIDGE_ROUTE_NAMES.postThread}`)
  assert.equal(bridgeRoute(composer())?.pathname, `/${BRIDGE_ROUTE_NAMES.composer}`)

  assert.equal(bridgeRoute(hostMode("c1"))?.pathname, `/${BRIDGE_ROUTE_NAMES.hostMode}`)
  assert.equal(bridgeRoute(hostCheckin("c1"))?.pathname, `/${BRIDGE_ROUTE_NAMES.hostCheckin}`)
  assert.equal(bridgeRoute(myTicket("c1", "s1"))?.pathname, `/${BRIDGE_ROUTE_NAMES.myTicketSeat}`)
  assert.equal(bridgeRoute(org("acme"))?.pathname, `/${BRIDGE_ROUTE_NAMES.org}`)

  for (const entry of [
    thread("A"),
    postThread("P"),
    composer("reply", "P1"),
    composer(),
    hostMode("c1"),
    hostCheckin("c1"),
    myTicket("c1"),
    myTicket("c1", "s1"),
    org("acme"),
  ]) {
    const route = bridgeRoute(entry)
    assert.ok(route)
    assert.equal(nativeBridgeKey({ name: route.pathname.slice(1), params: route.params }), bridgeKey(entry))
  }
})

test("a screen that is not one of the bridged routes has no native key", () => {
  assert.equal(nativeBridgeKey(null), null)
  assert.equal(nativeBridgeKey(undefined), null)
  assert.equal(nativeBridgeKey({ name: "index" }), null)
  assert.equal(nativeBridgeKey({ name: "pin/[id]", params: { id: "r1" } }), null)
  assert.equal(nativeBridgeKey({ name: "messages/dm/[id]", params: { id: "A" } }), null)
  assert.equal(nativeBridgeKey({ name: BRIDGE_ROUTE_NAMES.thread }), null)
  assert.equal(nativeBridgeKey({ name: BRIDGE_ROUTE_NAMES.thread, params: { id: 7 } }), null)
})

test("the room kind rides in the params but never in the native key - the room id identifies the screen", () => {
  assert.equal(
    nativeBridgeKey({ name: BRIDGE_ROUTE_NAMES.thread, params: { id: "A", roomKind: "dm" } }),
    "thread:A",
  )
  assert.equal(nativeBridgeKey({ name: BRIDGE_ROUTE_NAMES.composer }), "composer:post:")
})

test("a notification for the thread ALREADY on screen drops instead of pushing a second copy", () => {
  const { actions } = run([
    { active: thread("A"), now: 0 },
    { active: null, now: 0 },
    { active: thread("A"), now: 30_000, focused: "thread:A" },
  ])
  assert.equal(actions[0].type, "bridge")
  assert.equal(actions[2].type, "drop")
  assert.equal((actions[2] as { key: string }).key, "thread:A")
})

test("the same notification long after the repeat window still bridges when that screen is NOT the one on top", () => {
  const { actions } = run([
    { active: thread("A"), now: 0 },
    { active: null, now: 0 },
    { active: thread("A"), now: 30_000, focused: null },
  ])
  assert.equal(actions[2].type, "bridge")
})

test("a notification for a DIFFERENT room still pushes while the first room is on screen", () => {
  const { actions } = run([
    { active: thread("B"), now: 30_000, focused: "thread:A" },
  ])
  assert.equal(actions[0].type, "bridge")
  assert.equal((actions[0] as { key: string }).key, "thread:B")
})

test("post-thread and composer honour the on-screen check the same way", () => {
  const { actions } = run([
    { active: postThread("P"), now: 5000, focused: "post-thread:P" },
    { active: null, now: 5000 },
    { active: composer("reply", "P1"), now: 6000, focused: "composer:reply:P1" },
  ])
  assert.equal(actions[0].type, "drop")
  assert.equal(actions[2].type, "drop")
})

test("stackWithoutBridged removes exactly the bridged entry, not whatever is on top", () => {
  const stack: DetailEntry[] = [{ kind: "messages" }, thread("A"), { kind: "pin", id: "r1" }]
  assert.deepEqual(stackWithoutBridged(stack, "thread:A"), [
    { kind: "messages" },
    { kind: "pin", id: "r1" },
  ])
})

test("stackWithoutBridged removes the LAST match and reports nothing to do when absent", () => {
  const stack: DetailEntry[] = [thread("A"), { kind: "pin", id: "r1" }, thread("A")]
  assert.deepEqual(stackWithoutBridged(stack, "thread:A"), [thread("A"), { kind: "pin", id: "r1" }])
  assert.equal(stackWithoutBridged(stack, "thread:B"), null)
  assert.equal(stackWithoutBridged([], "thread:A"), null)
})

test("the day-of host surfaces are their own full-screen routes, keyed by event", () => {
  assert.equal(bridgeRoute(hostMode("c1"))?.params.id, "c1")
  assert.equal(bridgeRoute(hostCheckin("c1"))?.params.id, "c1")
  assert.equal(bridgeRoute(org("acme"))?.params.slug, "acme")
  assert.deepEqual(bridgeRoute(myTicket("c1"))?.params, { id: "c1" })
  assert.deepEqual(bridgeRoute(myTicket("c1", "s2"))?.params, { id: "c1", seatId: "s2" })
})

test("the seat is a path segment on both sides, so one seat is one screen", () => {
  assert.equal(bridgeRoute(myTicket("c1"))?.pathname, `/${BRIDGE_ROUTE_NAMES.myTicket}`)
  assert.equal(bridgeRoute(myTicket("c1", "s2"))?.pathname, `/${BRIDGE_ROUTE_NAMES.myTicketSeat}`)
  for (const name of MY_TICKET_ROUTE_NAMES) {
    assert.equal(nativeBridgeKey({ name, params: { id: "c1", seatId: "s2" } }), "my-ticket:c1:s2")
    assert.equal(nativeBridgeKey({ name, params: { id: "c1" } }), "my-ticket:c1:")
  }
})

test("a screen that HOSTS the shared shell keeps its entry when it is already on top", () => {
  for (const entry of [hostMode("c1"), hostCheckin("c1"), myTicket("c1", "s1"), org("acme")]) {
    const key = bridgeKey(entry)
    assert.ok(key)
    assert.ok(SHELL_HOSTED_BRIDGE_KINDS.includes(entry.kind))
    const decision = bridgeDecision(entry, INITIAL_BRIDGE_GUARD, 0, key)
    assert.equal(decision.action.type, "none")
    assert.equal(decision.guard.openKey, key)
  }
})

test("a screen that renders its OWN body still drops the entry when it is already on top", () => {
  for (const entry of [thread("A"), postThread("P"), composer("reply", "P1")]) {
    const key = bridgeKey(entry)
    assert.ok(key)
    assert.equal(bridgeDecision(entry, INITIAL_BRIDGE_GUARD, 0, key).action.type, "drop")
  }
})

test("an id-less host entry and a slug-less org are never bridged", () => {
  assert.equal(bridgeKey({ kind: "host-mode" }), null)
  assert.equal(bridgeKey({ kind: "host-checkin" }), null)
  assert.equal(bridgeKey({ kind: "my-ticket" }), null)
  assert.equal(bridgeKey({ kind: "org" }), null)
  assert.equal(bridgeRoute({ kind: "my-ticket" }), null)
  assert.equal(bridgeRoute({ kind: "org" }), null)
})

test("the quick broadcast stays in the sheet so its draft guard applies", () => {
  assert.equal(bridgeKey({ kind: "host-broadcast-quick", id: "c1" }), null)
  assert.equal(bridgeRoute({ kind: "host-broadcast-quick", id: "c1" }), null)
  const { actions } = run([{ active: { kind: "host-broadcast-quick", id: "c1" }, now: 0 }])
  assert.equal(actions[0].type, "none")
})

test("my-donations is reached from settings in the sheet, never as a native screen", () => {
  assert.equal(bridgeKey({ kind: "my-donations" }), null)
  assert.equal(bridgeRoute({ kind: "my-donations" }), null)
  assert.equal(nativeBridgeKey({ name: "me/donations" }), null)
})

test("two seats of the same ticket are two different screens", () => {
  const { actions } = run([
    { active: myTicket("c1", "s1"), now: 0 },
    { active: null, now: 0 },
    { active: myTicket("c1", "s2"), now: 100 },
  ])
  assert.equal(actions[0].type, "bridge")
  assert.equal(actions[2].type, "bridge")
  assert.equal((actions[2] as { key: string }).key, "my-ticket:c1:s2")
})

test("a host screen already on top is left alone - its entry IS what that screen renders", () => {
  const { actions, guard } = run([
    { active: hostCheckin("c1"), now: 0 },
    { active: null, now: 0 },
    { active: hostCheckin("c1"), now: 30_000, focused: "host-checkin:c1" },
  ])
  assert.equal(actions[0].type, "bridge")
  assert.equal(actions[2].type, "none")
  assert.equal(guard.openKey, "host-checkin:c1")
})

test("a shell-hosted seed is dropped when a teardown lands back on the root sheet", () => {
  const pin: DetailEntry = { kind: "pin", id: "p1" }
  assert.deepEqual(stackWithoutShellHosted([pin, hostMode("c1")]), [pin])
  assert.deepEqual(
    stackWithoutShellHosted([pin, org("acme"), myTicket("c1", "s1"), hostCheckin("c1")]),
    [pin],
  )
  assert.deepEqual(stackWithoutShellHosted([hostMode("c1")]), [])
})

test("the entries the root sheet renders itself survive that teardown untouched", () => {
  const stack: DetailEntry[] = [{ kind: "pin", id: "p1" }, thread("r1"), postThread("P1")]
  assert.deepEqual(stackWithoutShellHosted(stack), stack)
  assert.deepEqual(stackWithoutShellHosted([]), [])
})
