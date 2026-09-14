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

const SHELL_HOSTED = {
  entryKey: "person:u1:::::",
  activeKey: null,
  bridged: false,
  bridgeFocused: false,
  shellFocused: true,
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

test("a link to the entry the shell is ALREADY showing changes nothing", () => {
  assert.equal(
    internalHrefAction({ ...SHELL_HOSTED, activeKey: SHELL_HOSTED.entryKey }),
    "none",
  )
})

test("a link to a different entry navigates in place while a shell is on top", () => {
  assert.equal(internalHrefAction({ ...SHELL_HOSTED, activeKey: "pin:r1:::::" }), "navigate")
  assert.equal(internalHrefAction(SHELL_HOSTED), "navigate")
})

test("only a route that hosts no shell dismisses back to the root one", () => {
  assert.equal(
    internalHrefAction({ ...SHELL_HOSTED, shellFocused: false }),
    "navigate-and-dismiss",
  )
  assert.equal(
    internalHrefAction({ ...SHELL_HOSTED, shellFocused: false, activeKey: SHELL_HOSTED.entryKey }),
    "navigate-and-dismiss",
  )
})

test("a bridged entry is left to the router bridge, never dismissed out from under it", () => {
  const bridged = { ...SHELL_HOSTED, entryKey: "thread:room-1:dm::::", bridged: true }
  assert.equal(internalHrefAction({ ...bridged, shellFocused: false }), "navigate")
  assert.equal(internalHrefAction(bridged), "navigate")
})

test("a bridged entry whose own screen is already on top changes nothing", () => {
  assert.equal(
    internalHrefAction({
      ...SHELL_HOSTED,
      entryKey: "thread:room-1:dm::::",
      bridged: true,
      bridgeFocused: true,
      shellFocused: false,
    }),
    "none",
  )
})
