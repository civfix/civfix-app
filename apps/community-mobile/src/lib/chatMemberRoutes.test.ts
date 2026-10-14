/**
 * These chat-header route files must spell @civfix/ui's `pathForEntry` URLs exactly, and nothing else
 * enforces it, so this calls the real function from the package the app imports.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { loadNavRoutes } from "../../tests/helpers/navRoutes.ts"

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "app")

type PathForEntry = (entry: unknown) => string

const { pathForEntry } = await loadNavRoutes<{ pathForEntry: PathForEntry }>()

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
