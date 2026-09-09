import assert from "node:assert/strict"
import { test } from "node:test"
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

const cleanup = { kind: "cleanup", id: "c1" } as DetailEntry
const hostMode = { kind: "host-mode", id: "c1" } as DetailEntry
const hostCheckin = { kind: "host-checkin", id: "c1" } as DetailEntry

test("restorableStack keeps an unbridged entry", () => {
  assert.deepEqual(restorableStack([cleanup], null), [cleanup])
})

test("restorableStack drops a bridged entry whose native route is not focused", () => {
  assert.deepEqual(restorableStack([hostMode], null), [])
  assert.deepEqual(restorableStack([hostMode], "host-checkin:c1"), [])
  assert.deepEqual(restorableStack([hostMode], "host-mode:c1"), [hostMode])
})

const base = {
  restore: [cleanup],
  seedKey: identity(hostMode),
  activeKey: identity(hostMode),
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

test("discards the snapshot when the native stack was torn down under it", () => {
  assert.deepEqual(
    detailRestorePlan({ ...base, activeKey: null, stackLength: 0, tornDown: true }),
    { type: "skip", reason: "torn-down" },
  )
  assert.deepEqual(detailRestorePlan({ ...base, tornDown: true }), {
    type: "skip",
    reason: "torn-down",
  })
})

test("discards the snapshot when the store was emptied by something other than this host", () => {
  assert.deepEqual(detailRestorePlan({ ...base, activeKey: null, stackLength: 0 }), {
    type: "skip",
    reason: "removed",
  })
})

test("leaves the store alone when another host has already seeded it", () => {
  assert.deepEqual(detailRestorePlan({ ...base, activeKey: identity(hostCheckin) }), {
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
      return plan
    },
  }
}

test("two nested hosts unmounting after reset() + dismissTo('/') push nothing", () => {
  const sim = makeSim()
  sim.push(cleanup)
  sim.push(hostMode)
  const outer = sim.mountHost(hostMode)
  sim.push(hostCheckin)
  const inner = sim.mountHost(hostCheckin)

  assert.deepEqual(sim.native, ["index", "cleanups/[id]/host", "cleanups/[id]/checkin"])
  const pushesBefore = [...sim.pushes]
  assert.equal(pushesBefore.length, 2)

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
  sim.push(hostMode)
  const host = sim.mountHost(hostMode)

  sim.reset()
  sim.dismissToHome()
  assert.deepEqual(sim.unmountHost(host), { type: "skip", reason: "torn-down" })
  assert.deepEqual(sim.stack, [])
  assert.deepEqual(sim.pushes, ["/cleanups/[id]/host"])
})

test("backing out of a host restores the sheet it replaced without re-pushing it", () => {
  const sim = makeSim()
  sim.push(cleanup)
  sim.push(hostMode)
  const host = sim.mountHost(hostMode)

  const plan = sim.unmountHost(host)
  assert.deepEqual(plan, { type: "restore", stack: [cleanup] })
  assert.deepEqual(sim.stack, [cleanup])
  assert.deepEqual(sim.pushes, ["/cleanups/[id]/host"])
})

test("popping the inner host hands the outer entry back without re-pushing its screen", () => {
  const sim = makeSim()
  sim.push(cleanup)
  sim.push(hostMode)
  sim.mountHost(hostMode)
  sim.push(hostCheckin)
  const inner = sim.mountHost(hostCheckin)

  sim.popNative()
  inner.left = true
  assert.deepEqual(sim.unmountHost(inner), { type: "restore", stack: [hostMode] })
  assert.deepEqual(sim.stack, [hostMode])
  assert.deepEqual(sim.pushes, ["/cleanups/[id]/host", "/cleanups/[id]/checkin"])
})

test("a bridged entry is never re-inserted while its native route is not focused", () => {
  const sim = makeSim()
  sim.push(cleanup)
  sim.push(hostMode)
  sim.mountHost(hostMode)
  sim.push(hostCheckin)
  const inner = sim.mountHost(hostCheckin)

  inner.left = true
  assert.deepEqual(sim.unmountHost(inner), { type: "restore", stack: [] })
  assert.deepEqual(sim.stack, [])
  assert.deepEqual(sim.pushes, ["/cleanups/[id]/host", "/cleanups/[id]/checkin"])
})
