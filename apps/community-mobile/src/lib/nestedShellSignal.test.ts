import assert from "node:assert/strict"
import { test } from "node:test"
import type { DetailEntry } from "@civfix/ui"
import {
  NO_NESTED_SHELL,
  nestedShellBodyEntry,
  rootIsTopRoute,
  withNestedShellHost,
  withoutNestedShellHost,
  withoutNestedShellHosts,
} from "./nestedShellSignal.ts"

const cleanup = { kind: "cleanup", id: "c1" } as DetailEntry
const org = { kind: "org", slug: "acme" } as DetailEntry

test("a host ABOVE the root defers the root body to the entry the root held before it", () => {
  const state = withNestedShellHost(NO_NESTED_SHELL, "h1", cleanup)
  assert.deepEqual(nestedShellBodyEntry(state, org), { render: true, entry: cleanup })
})

test("a host above the root with an empty snapshot renders no root body", () => {
  const state = withNestedShellHost(NO_NESTED_SHELL, "h1", null)
  assert.deepEqual(nestedShellBodyEntry(state, cleanup), { render: false })
})

test("a host left BELOW the root by a POP_TO replace stops deferring the root body", () => {
  const mounted = withNestedShellHost(NO_NESTED_SHELL, "h1", null)
  assert.deepEqual(nestedShellBodyEntry(mounted, cleanup), { render: false })
  const rootFocused = withoutNestedShellHosts(mounted)
  assert.deepEqual(rootFocused, NO_NESTED_SHELL)
  assert.deepEqual(nestedShellBodyEntry(rootFocused, cleanup), { render: true, entry: cleanup })
})

test("the root focusing clears every host, since nothing can sit above a focused root", () => {
  const two = withNestedShellHost(withNestedShellHost(NO_NESTED_SHELL, "h1", cleanup), "h2", null)
  assert.deepEqual(two.hosts, ["h1", "h2"])
  assert.equal(withoutNestedShellHosts(two).hosts.length, 0)
  assert.equal(withoutNestedShellHosts(NO_NESTED_SHELL), NO_NESTED_SHELL)
})

test("a blurred host only leaves the signal when the ROOT is the top route", () => {
  assert.equal(rootIsTopRoute({ name: "index" }), true)
  assert.equal(rootIsTopRoute({ name: "cleanups/[id]" }), false)
  assert.equal(rootIsTopRoute({ name: "cleanups/[id]/ticket/index" }), false)
  assert.equal(rootIsTopRoute({ name: "auth" }), false)
  assert.equal(rootIsTopRoute({}), false)
  assert.equal(rootIsTopRoute(null), false)
  assert.equal(rootIsTopRoute(undefined), false)
})

test("hosts are counted by identity, so a double exit cannot unblank a shell still above the root", () => {
  const two = withNestedShellHost(withNestedShellHost(NO_NESTED_SHELL, "h1", cleanup), "h2", null)
  const once = withoutNestedShellHost(two, "h1")
  assert.deepEqual(once.hosts, ["h2"])
  assert.deepEqual(withoutNestedShellHost(once, "h1"), once)
  assert.deepEqual(nestedShellBodyEntry(once, org), { render: true, entry: cleanup })
  assert.deepEqual(withoutNestedShellHost(once, "h2"), NO_NESTED_SHELL)
})

test("re-entering with the same host id keeps the first snapshot", () => {
  const state = withNestedShellHost(NO_NESTED_SHELL, "h1", cleanup)
  assert.equal(withNestedShellHost(state, "h1", org), state)
})

test("with no host mounted the root always renders its own entry", () => {
  assert.deepEqual(nestedShellBodyEntry(NO_NESTED_SHELL, cleanup), { render: true, entry: cleanup })
  assert.deepEqual(nestedShellBodyEntry(NO_NESTED_SHELL, null), { render: true, entry: null })
  const state = withNestedShellHost(NO_NESTED_SHELL, "h1", cleanup)
  assert.deepEqual(nestedShellBodyEntry(state, null), { render: true, entry: null })
})
