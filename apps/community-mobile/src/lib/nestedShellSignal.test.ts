import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { DetailEntry } from "@civfix/ui"
import {
  NO_NESTED_SHELL,
  ROOT_SHELL_ID,
  rootIsTopRoute,
  shellStackBelow,
  withNestedShellHost,
  withoutNestedShellHost,
  withoutNestedShellHosts,
} from "./nestedShellSignal.ts"

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..")
const APP_DIR = join(SRC_DIR, "..", "app")

const cleanup = { kind: "cleanup", id: "c1" } as DetailEntry
const org = { kind: "org", slug: "acme" } as DetailEntry
const person = { kind: "person", id: "u1" } as DetailEntry

test("with no host mounted every shell reads the live store", () => {
  assert.equal(shellStackBelow(NO_NESTED_SHELL, ROOT_SHELL_ID), null)
  assert.equal(shellStackBelow(NO_NESTED_SHELL, "h1"), null)
})

test("the root renders the stack it owned when the first host took over", () => {
  const state = withNestedShellHost(NO_NESTED_SHELL, "h1", [cleanup])
  assert.deepEqual(shellStackBelow(state, ROOT_SHELL_ID), [cleanup])
})

test("a root that owned no detail renders an EMPTY stack, never the host's entry", () => {
  const state = withNestedShellHost(NO_NESTED_SHELL, "h1", [])
  assert.deepEqual(shellStackBelow(state, ROOT_SHELL_ID), [])
})

test("the top host reads the live store, and every host below it reads its own snapshot", () => {
  const one = withNestedShellHost(NO_NESTED_SHELL, "h1", [cleanup])
  const two = withNestedShellHost(one, "h2", [org])
  assert.deepEqual(shellStackBelow(two, ROOT_SHELL_ID), [cleanup])
  assert.deepEqual(shellStackBelow(two, "h1"), [org])
  assert.equal(shellStackBelow(two, "h2"), null)
})

test("a host that has not registered yet reads the live store", () => {
  const state = withNestedShellHost(NO_NESTED_SHELL, "h1", [cleanup])
  assert.equal(shellStackBelow(state, "unregistered"), null)
})

test("a snapshot is returned by reference, so a selector does not churn the shell", () => {
  const snapshot = [cleanup]
  const state = withNestedShellHost(NO_NESTED_SHELL, "h1", snapshot)
  assert.equal(shellStackBelow(state, ROOT_SHELL_ID), snapshot)
})

test("hosts are counted by identity, so a double exit cannot unfreeze a shell still covered", () => {
  const two = withNestedShellHost(withNestedShellHost(NO_NESTED_SHELL, "h1", [cleanup]), "h2", [org])
  const once = withoutNestedShellHost(two, "h2")
  assert.deepEqual(
    once.hosts.map((host) => host.id),
    ["h1"],
  )
  assert.deepEqual(withoutNestedShellHost(once, "h2"), once)
  assert.deepEqual(shellStackBelow(once, ROOT_SHELL_ID), [cleanup])
  assert.deepEqual(withoutNestedShellHost(once, "h1"), NO_NESTED_SHELL)
})

test("re-entering with the same host id keeps the first snapshot", () => {
  const state = withNestedShellHost(NO_NESTED_SHELL, "h1", [cleanup])
  assert.equal(withNestedShellHost(state, "h1", [person]), state)
})

test("the root focusing clears every host, since nothing can sit above a focused root", () => {
  const two = withNestedShellHost(withNestedShellHost(NO_NESTED_SHELL, "h1", [cleanup]), "h2", [org])
  assert.equal(withoutNestedShellHosts(two).hosts.length, 0)
  assert.equal(withoutNestedShellHosts(NO_NESTED_SHELL), NO_NESTED_SHELL)
})

test("a blurred host only leaves the signal when the ROOT is the top route", () => {
  assert.equal(rootIsTopRoute({ name: "index" }), true)
  assert.equal(rootIsTopRoute({ name: "cleanups/[id]" }), false)
  assert.equal(rootIsTopRoute({ name: "cleanups/[id]/ticket/index" }), false)
  assert.equal(rootIsTopRoute({}), false)
  assert.equal(rootIsTopRoute(null), false)
  assert.equal(rootIsTopRoute(undefined), false)
})

test("the root shell hands its owned stack to AppShell instead of blanking its body", () => {
  const rootScreen = readFileSync(join(APP_DIR, "index.tsx"), "utf8")
  assert.match(
    rootScreen,
    /const ownedStack = useNestedShellStore\(\(s\) => shellStackBelow\(s, ROOT_SHELL_ID\)\)/,
  )
  assert.match(rootScreen, /\{\.\.\.\(ownedStack \? \{ stack: ownedStack \} : \{\}\)\}/)
  assert.doesNotMatch(rootScreen, /nestedShellBodyEntry/)
})

test("a detail host registers BEFORE it seeds, so the shell below never renders its entry", () => {
  const host = readFileSync(join(SRC_DIR, "components", "DetailRouteHost.tsx"), "utf8")
  const register = host.indexOf("enterNestedShell(hostId, restoreRef.current)")
  const seed = host.indexOf("if (entry) seedEntry(entry)")
  assert.ok(register > 0, "DetailRouteHost no longer registers its snapshot")
  assert.ok(seed > register, "DetailRouteHost seeds the store before it registers its snapshot")
  assert.match(host, /const ownedStack = useNestedShellStore\(\(s\) => shellStackBelow\(s, hostId\)\)/)
})
