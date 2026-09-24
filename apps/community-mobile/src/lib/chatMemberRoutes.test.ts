/**
 * These chat-header route files must spell @civfix/ui's `pathForEntry` URLs exactly, and nothing else
 * enforces it, so this calls the real function from the package the app imports.
 *
 * It is loaded by transpiling `src/nav/routes.ts` in memory: `@civfix/ui/nav` has extensionless imports
 * node's ESM resolver rejects, `routes.ts` is not in the package `exports`, and node refuses to strip types
 * under node_modules (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING), so a by-path import would pass in a
 * linked checkout and fail on a registry install.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "app")

type PathForEntry = (entry: unknown) => string

async function loadNavRoutes(): Promise<{ pathForEntry: PathForEntry }> {
  const require = createRequire(import.meta.url)
  // Resolved through the package specifier so it follows the same @civfix/ui the app imports.
  const routesPath = join(dirname(require.resolve("@civfix/ui/package.json")), "src", "nav", "routes.ts")
  const ts = require("typescript")
  const { outputText } = ts.transpileModule(readFileSync(routesPath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  })
  return import(`data:text/javascript,${encodeURIComponent(outputText)}`)
}

const { pathForEntry } = await loadNavRoutes()

const CHAT_HEADER_ROUTES = [
  {
    label: 'pathForEntry({ kind: "group-info", id: "g1" })',
    entry: { kind: "group-info", id: "g1" },
    url: "/groups/g1/info",
    routeFile: "groups/[id]/info.tsx",
    params: { id: "g1" },
  },
  {
    label: 'pathForEntry({ kind: "members", id: "room-1", roomKind: "cleanup" })',
    entry: { kind: "members", id: "room-1", roomKind: "cleanup" },
    url: "/messages/members/cleanup/room-1",
    routeFile: "messages/members/[roomKind]/[id].tsx",
    params: { roomKind: "cleanup", id: "room-1" },
  },
  {
    label: 'pathForEntry({ kind: "members", id: "room-1", roomKind: "group" })',
    entry: { kind: "members", id: "room-1", roomKind: "group" },
    url: "/messages/members/group/room-1",
    routeFile: "messages/members/[roomKind]/[id].tsx",
    params: { roomKind: "group", id: "room-1" },
  },
] as const

function routeFileForUrl(url: string, params: Readonly<Record<string, string>>): string {
  const segments = url.split("/").filter(Boolean)
  const byValue = new Map(Object.entries(params).map(([name, value]) => [value, `[${name}]`]))
  return `${segments.map((segment) => byValue.get(segment) ?? segment).join("/")}.tsx`
}

for (const route of CHAT_HEADER_ROUTES) {
  test(`${route.label} is served by app/${route.routeFile}`, () => {
    // The shared round-trip tests are self-consistent under any URL shape, so only this catches a change.
    const url = pathForEntry(route.entry)
    assert.equal(url, route.url)
    assert.equal(routeFileForUrl(url, route.params), route.routeFile)
    assert.equal(existsSync(join(APP_DIR, route.routeFile)), true, `missing route file app/${route.routeFile}`)
  })
}

test("the members route is FOUR segments, so it cannot collide with app/messages/[id].tsx", () => {
  // `[id]` is a single segment, not a catch-all, so it matches "/messages/<one>" only.
  assert.equal(pathForEntry({ kind: "members", id: "room-1", roomKind: "cleanup" }).split("/").filter(Boolean).length, 4)
  assert.equal("/messages/room-1".split("/").filter(Boolean).length, 2)
  assert.equal(existsSync(join(APP_DIR, "messages/[id].tsx")), true)
  assert.equal(existsSync(join(APP_DIR, "messages/dm/[id].tsx")), true)
})

test("the shell route app/groups/[id]/info.tsx resets to on leave-group exists", () => {
  // React Navigation drops a reset naming a route the navigator lacks, which would strand the viewer on the
  // info screen after a cold `civfix://messages/<id>` open; the shell's route name is `pathForEntry(null)`.
  assert.equal(pathForEntry(null), "/")
  assert.equal(existsSync(join(APP_DIR, "index.tsx")), true)
})
