import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { test } from "node:test"
import {
  SHELL_HOST_ROUTE_NAMES,
  internalHrefAction,
  normalizeRouteName,
  shellHostsEntries,
  type InternalHrefAction,
  type InternalHrefInput,
} from "./internalHref.ts"
import { ROOT_ROUTE_NAME } from "./nestedShellSignal.ts"

const APP_DIR = fileURLToPath(new URL("../../app", import.meta.url))

function routeFiles(dir: string, prefix = ""): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      out.push(...routeFiles(full, `${prefix}${name}/`))
      continue
    }
    if (!name.endsWith(".tsx") || name.startsWith("_") || name.startsWith("+")) continue
    out.push(`${prefix}${name.slice(0, -".tsx".length)}`)
  }
  return out
}

test("the shell-host list names the root shell and nothing narrower", () => {
  assert.equal(SHELL_HOST_ROUTE_NAMES.includes(ROOT_ROUTE_NAME), true)
})

test("the shell-host list is exactly the routes that mount a shell", () => {
  const mounts = routeFiles(APP_DIR)
    .filter((route) =>
      readFileSync(join(APP_DIR, `${route}.tsx`), "utf8").includes("DetailRouteHost"),
    )
    .map(normalizeRouteName)
  const expected = [ROOT_ROUTE_NAME, ...mounts].sort()
  assert.deepEqual([...SHELL_HOST_ROUTE_NAMES].sort(), expected)
})

test("an expo-router index route is recognised under either name it reports", () => {
  assert.equal(shellHostsEntries({ name: "cleanups/[id]/ticket" }), true)
  assert.equal(shellHostsEntries({ name: "cleanups/[id]/ticket/index" }), true)
  assert.equal(shellHostsEntries({ name: ROOT_ROUTE_NAME }), true)
  assert.equal(normalizeRouteName("index"), "index")
})

test("a full-screen route that hosts no shell is not one", () => {
  for (const name of ["messages/[id]", "compose", "post/[id]", "settings/index", "scan"]) {
    assert.equal(shellHostsEntries({ name }), false, name)
  }
  assert.equal(shellHostsEntries(null), false)
  assert.equal(shellHostsEntries({}), false)
})

const IN_SHELL: InternalHrefInput = {
  entryKey: "person:u1:::::",
  activeKey: null,
  bridged: false,
  bridgeFocused: false,
  shellFocused: true,
  routeFocused: true,
  detailRoute: true,
}

const IN_CONVERSATION: InternalHrefInput = { ...IN_SHELL, shellFocused: false }

const COLD_START: InternalHrefInput = {
  ...IN_SHELL,
  shellFocused: false,
  routeFocused: false,
}

const ACTIONS: readonly [string, InternalHrefInput, InternalHrefAction][] = [
  ["a bridged entry whose own screen is already on top", { ...IN_SHELL, bridged: true, bridgeFocused: true }, "none"],
  ["a bridged entry opened from anywhere else", { ...IN_CONVERSATION, bridged: true }, "navigate"],
  ["the entry the focused shell is already showing", { ...IN_SHELL, activeKey: IN_SHELL.entryKey }, "none"],
  ["another entry while a shell is focused", { ...IN_SHELL, activeKey: "pin:r1:::::" }, "navigate"],
  ["an entity link tapped inside a full-screen route", IN_CONVERSATION, "push-route"],
  ["an entity link to the entry the root shell happens to hold", { ...IN_CONVERSATION, activeKey: IN_CONVERSATION.entryKey }, "push-route"],
  ["a link with no detail route of its own", { ...IN_CONVERSATION, detailRoute: false }, "navigate-and-dismiss"],
  ["a deep link that arrives before any route is focused", COLD_START, "navigate-and-dismiss"],
  ["a cold-start deep link with no detail route either", { ...COLD_START, detailRoute: false }, "navigate-and-dismiss"],
]

test("the internal-href action table", () => {
  for (const [name, input, expected] of ACTIONS) {
    assert.equal(internalHrefAction(input), expected, name)
  }
})

test("a link tapped in a conversation drills down instead of dismissing the conversation", () => {
  assert.equal(internalHrefAction(IN_CONVERSATION), "push-route")
  assert.notEqual(internalHrefAction(IN_CONVERSATION), "navigate-and-dismiss")
})

test("only a route with nothing to push falls back to dismissing to the root shell", () => {
  assert.equal(internalHrefAction({ ...IN_CONVERSATION, detailRoute: false }), "navigate-and-dismiss")
  assert.equal(internalHrefAction({ ...COLD_START, bridged: false }), "navigate-and-dismiss")
})

test("a focused shell still navigates in place, never pushing a second host for the same entry", () => {
  assert.equal(internalHrefAction(IN_SHELL), "navigate")
  assert.equal(internalHrefAction({ ...IN_SHELL, activeKey: IN_SHELL.entryKey }), "none")
})
