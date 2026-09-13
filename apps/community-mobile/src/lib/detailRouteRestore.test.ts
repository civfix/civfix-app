import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import type { DetailEntry } from "@civfix/ui"
import {
  INITIAL_BRIDGE_GUARD,
  bridgeDecision,
  detailRestorePlan,
  nativeBridgeKey,
  restorableStack,
  stackWithoutBridged,
  type BridgeGuard,
} from "./navBridge.ts"

const identity = (entry: DetailEntry | null): string | null =>
  entry
    ? `${entry.kind}:${entry.id ?? ""}:${entry.roomKind ?? ""}:${entry.geoid ?? ""}:${entry.slug ?? ""}:${entry.seatId ?? ""}`
    : null

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "app")

const cleanup = { kind: "cleanup", id: "c1" } as DetailEntry
const dashboard = { kind: "event-dashboard" } as DetailEntry
const hostCheckin = { kind: "host-checkin", id: "c1" } as DetailEntry
const thread = { kind: "thread", id: "t1", roomKind: "dm" } as DetailEntry
const person = { kind: "person", id: "u1" } as DetailEntry
const pin = { kind: "pin", id: "r1" } as DetailEntry
const followers = { kind: "followers", id: "u1" } as DetailEntry

test("restorableStack keeps an unbridged entry", () => {
  assert.deepEqual(restorableStack([cleanup], null), [cleanup])
})

test("restorableStack keeps every host surface, because none of them is bridged any more", () => {
  assert.deepEqual(restorableStack([dashboard, hostCheckin], null), [dashboard, hostCheckin])
})

test("restorableStack drops a bridged entry whose native route is not focused", () => {
  assert.deepEqual(restorableStack([thread], null), [])
  assert.deepEqual(restorableStack([thread], "thread:other"), [])
  assert.deepEqual(restorableStack([thread], "thread:t1"), [thread])
})

const base = {
  restore: [cleanup],
  seedKey: identity(person),
  activeKey: identity(person),
  stackLength: 1,
  left: false,
  tornDown: false,
  focusedBridgeKey: null,
}

test("restores when the host leaves with the store still holding what it seeded", () => {
  assert.deepEqual(detailRestorePlan(base), { type: "restore", stack: [cleanup] })
})

test("restores when the host itself navigated away and emptied the store", () => {
  assert.deepEqual(detailRestorePlan({ ...base, activeKey: null, stackLength: 0, left: true }), {
    type: "restore",
    stack: [cleanup],
  })
})

test("discards the snapshot when the native stack was torn down out from under it", () => {
  assert.deepEqual(
    detailRestorePlan({ ...base, activeKey: null, stackLength: 0, tornDown: true }),
    { type: "skip", reason: "torn-down" },
  )
})

test("a teardown clears the seed this host is still showing, so it cannot ghost into the root shell", () => {
  assert.deepEqual(detailRestorePlan({ ...base, tornDown: true }), { type: "clear" })
})

test("a teardown leaves a store another host has already re-seeded alone", () => {
  assert.deepEqual(
    detailRestorePlan({ ...base, activeKey: identity(pin), tornDown: true }),
    { type: "skip", reason: "torn-down" },
  )
})

test("discards the snapshot when the store was emptied by something other than this host", () => {
  assert.deepEqual(detailRestorePlan({ ...base, activeKey: null, stackLength: 0 }), {
    type: "skip",
    reason: "removed",
  })
})

test("leaves the store alone when another host has already seeded it", () => {
  assert.deepEqual(detailRestorePlan({ ...base, activeKey: identity(pin) }), {
    type: "skip",
    reason: "not-ours",
  })
})

interface SimHost {
  seedKey: string | null
  restore: DetailEntry[]
  epoch: number
  left: boolean
}

function makeSim() {
  let stack: DetailEntry[] = []
  let active: DetailEntry | null = null
  let epoch = 0
  const native: { name: string; params: Record<string, string> }[] = [
    { name: "index", params: {} },
  ]
  const pushes: string[] = []
  let guard: BridgeGuard = INITIAL_BRIDGE_GUARD
  const listeners: (() => void)[] = []

  const setStack = (next: DetailEntry[]): void => {
    stack = next
    active = next[next.length - 1] ?? null
    for (const listener of [...listeners]) listener()
  }

  const focusedKey = (): string | null => nativeBridgeKey(native[native.length - 1])

  const decide = (): void => {
    const decision = bridgeDecision(active, guard, 100_000 + pushes.length * 1000, focusedKey())
    guard = decision.guard
    if (decision.action.type === "none") return
    const route = decision.action.type === "bridge" ? decision.action.route : null
    const next = stackWithoutBridged(stack, decision.action.key)
    if (!next) return
    setStack(next)
    if (route) {
      pushes.push(route.pathname)
      native.push({ name: route.pathname.slice(1), params: route.params })
    }
  }
  listeners.push(decide)

  return {
    get stack() {
      return stack
    },
    get pushes() {
      return pushes
    },
    get native() {
      return native.map((route) => route.name)
    },
    push(entry: DetailEntry) {
      setStack([...stack, entry])
    },
    back() {
      setStack(stack.slice(0, -1))
    },
    pushRoute(name: string, params: Record<string, string>) {
      native.push({ name, params })
    },
    reset() {
      epoch += 1
      setStack([])
    },
    dismissToHome() {
      epoch += 1
      native.splice(1)
    },
    popNative() {
      native.pop()
    },
    mountHost(entry: DetailEntry): SimHost {
      const host: SimHost = {
        seedKey: identity(entry),
        restore: stack.filter((e) => identity(e) !== identity(entry)),
        epoch,
        left: false,
      }
      setStack([entry])
      return host
    },
    unmountHost(host: SimHost) {
      const plan = detailRestorePlan({
        restore: host.restore,
        seedKey: host.seedKey,
        activeKey: identity(active),
        stackLength: stack.length,
        left: host.left,
        tornDown: epoch !== host.epoch,
        focusedBridgeKey: focusedKey(),
      })
      if (plan.type === "restore") setStack(plan.stack)
      else if (plan.type === "clear") setStack([])
      return plan
    },
  }
}

test("a host child opened from the event dashboard stacks in the shell and pushes no screen", () => {
  const sim = makeSim()
  sim.push(dashboard)
  sim.push(hostCheckin)

  assert.deepEqual(sim.pushes, [])
  assert.deepEqual(sim.native, ["index"])
  assert.deepEqual(sim.stack, [dashboard, hostCheckin])

  sim.back()
  assert.deepEqual(sim.stack, [dashboard])
  assert.deepEqual(sim.pushes, [])
})

test("no host surface is ever stripped out of the shell stack the way a thread is", () => {
  const sim = makeSim()
  sim.push(cleanup)
  sim.push({ kind: "host-mode", id: "c1" } as DetailEntry)
  sim.push({ kind: "host-team", id: "c1" } as DetailEntry)
  sim.push({ kind: "my-ticket", id: "c1" } as DetailEntry)
  sim.push({ kind: "org", slug: "acme" } as DetailEntry)
  sim.push({ kind: "host-log-hours", id: "c1" } as DetailEntry)

  assert.equal(sim.stack.length, 6)
  assert.deepEqual(sim.pushes, [])
})

test("two nested hosts unmounting after reset() + dismissTo('/') push nothing", () => {
  const sim = makeSim()
  sim.push(thread)
  sim.pushRoute("people/[id]", { id: "u1" })
  const outer = sim.mountHost(person)
  sim.pushRoute("pin/[id]", { id: "r1" })
  const inner = sim.mountHost(pin)

  assert.deepEqual(sim.native, ["index", "messages/[id]", "people/[id]", "pin/[id]"])
  const pushesBefore = [...sim.pushes]
  assert.deepEqual(pushesBefore, ["/messages/[id]"])

  sim.reset()
  sim.dismissToHome()
  sim.unmountHost(outer)
  sim.unmountHost(inner)

  assert.deepEqual(sim.pushes, pushesBefore)
  assert.deepEqual(sim.stack, [])
  assert.deepEqual(sim.native, ["index"])
})

test("a single host unmounting after sign-out does not bring the sheet back", () => {
  const sim = makeSim()
  sim.push(cleanup)
  sim.pushRoute("people/[id]", { id: "u1" })
  const host = sim.mountHost(person)

  sim.reset()
  sim.dismissToHome()
  assert.deepEqual(sim.unmountHost(host), { type: "skip", reason: "torn-down" })
  assert.deepEqual(sim.stack, [])
})

test("a host torn down while still showing its own seed clears it instead of stranding it", () => {
  const sim = makeSim()
  sim.push(cleanup)
  sim.pushRoute("people/[id]", { id: "u1" })
  const host = sim.mountHost(person)

  sim.dismissToHome()
  assert.deepEqual(sim.unmountHost(host), { type: "clear" })
  assert.deepEqual(sim.stack, [])
  assert.deepEqual(sim.native, ["index"])
})

test("backing out of a host restores the sheet it replaced without re-pushing it", () => {
  const sim = makeSim()
  sim.push(cleanup)
  sim.pushRoute("people/[id]", { id: "u1" })
  const host = sim.mountHost(person)

  const plan = sim.unmountHost(host)
  assert.deepEqual(plan, { type: "restore", stack: [cleanup] })
  assert.deepEqual(sim.stack, [cleanup])
  assert.deepEqual(sim.pushes, [])
})

test("popping the inner host hands the outer entry back without re-pushing its screen", () => {
  const sim = makeSim()
  sim.push(cleanup)
  sim.pushRoute("people/[id]", { id: "u1" })
  sim.mountHost(person)
  sim.pushRoute("pin/[id]", { id: "r1" })
  const inner = sim.mountHost(pin)

  sim.popNative()
  inner.left = true
  assert.deepEqual(sim.unmountHost(inner), { type: "restore", stack: [person] })
  assert.deepEqual(sim.stack, [person])
  assert.deepEqual(sim.pushes, [])
})

test("a bridged entry is never re-inserted while its native route is not focused", () => {
  const sim = makeSim()
  sim.push(cleanup)
  sim.push(thread)
  sim.pushRoute("people/[id]", { id: "u1" })
  const host = sim.mountHost(person)
  assert.deepEqual(host.restore, [cleanup])

  sim.popNative()
  sim.popNative()
  host.left = true
  assert.deepEqual(sim.unmountHost(host), { type: "restore", stack: [cleanup] })
  assert.deepEqual(sim.stack, [cleanup])
})

test("a profile a native screen pushed rides its own route, bridging nothing", () => {
  const sim = makeSim()
  sim.push(thread)
  assert.deepEqual(sim.native, ["index", "messages/[id]"])
  assert.deepEqual(sim.stack, [])

  sim.pushRoute("people/[id]", { id: "u1" })
  const host = sim.mountHost(person)

  assert.deepEqual(sim.pushes, ["/messages/[id]"])
  assert.deepEqual(sim.stack, [person])
  assert.deepEqual(host.restore, [])
})

test("the profile's children stack inside the nested shell instead of pushing screens", () => {
  const sim = makeSim()
  sim.push(thread)
  sim.pushRoute("people/[id]", { id: "u1" })
  sim.mountHost(person)

  sim.push(followers)
  sim.push(cleanup)
  assert.deepEqual(sim.stack, [person, followers, cleanup])
  assert.deepEqual(sim.pushes, ["/messages/[id]"])

  sim.back()
  sim.back()
  assert.deepEqual(sim.stack, [person])
  assert.deepEqual(sim.native, ["index", "messages/[id]", "people/[id]"])
})

test("leaving the profile hands the conversation back with nothing seeded behind it", () => {
  const sim = makeSim()
  sim.push(thread)
  sim.pushRoute("people/[id]", { id: "u1" })
  const host = sim.mountHost(person)

  sim.back()
  host.left = true
  sim.popNative()

  assert.deepEqual(sim.unmountHost(host), { type: "skip", reason: "noop" })
  assert.deepEqual(sim.stack, [])
  assert.deepEqual(sim.native, ["index", "messages/[id]"])
  assert.deepEqual(sim.pushes, ["/messages/[id]"])
})

const NESTED_SHELL_ROUTES = [
  { file: "people/[id].tsx", kind: "person" },
  { file: "profile/index.tsx", kind: "profile" },
  { file: "pin/[id].tsx", kind: "pin" },
  { file: "cleanups/[id]/index.tsx", kind: "cleanup" },
  { file: "cleanups/[id]/host.tsx", kind: "host-mode" },
  { file: "cleanups/[id]/checkin.tsx", kind: "host-checkin" },
  { file: "cleanups/[id]/team.tsx", kind: "host-team" },
  { file: "cleanups/[id]/hours.tsx", kind: "host-log-hours" },
  { file: "cleanups/[id]/ticket/index.tsx", kind: "my-ticket" },
  { file: "cleanups/[id]/ticket/[seatId].tsx", kind: "my-ticket" },
  { file: "orgs/[slug].tsx", kind: "org" },
  { file: "dashboard.tsx", kind: "event-dashboard" },
] as const

test("every detail route hosts its entry in a nested shell instead of seeding and dismissing", () => {
  for (const { file, kind } of NESTED_SHELL_ROUTES) {
    const source = readFileSync(join(APP_DIR, file), "utf8")
    assert.match(source, /DetailRouteHost/, `${file} must host ${kind} in a nested shell`)
    assert.doesNotMatch(source, /DeepLinkHost/, `${file} must not seed ${kind} and dismiss to home`)
    assert.match(source, new RegExp(`kind: "${kind}"`), `${file} must host the ${kind} entry`)
  }
})
