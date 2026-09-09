/**
 * THE TWO CHAT-HEADER ROUTE FILES MUST SPELL @civfix/ui's SHARED URLs EXACTLY (BUG 5).
 *
 * `app/groups/[id]/info.tsx` and `app/messages/members/[roomKind]/[id].tsx` exist because the chat is an
 * expo-router screen ABOVE the shell, so the shared bodies' default `useNavStore.push` would draw those
 * surfaces underneath it, invisibly. Their paths are deliberately @civfix/ui's `pathForEntry` output for the
 * matching nav entry — one surface, one URL on web and mobile — and nothing else enforces that: rename a
 * route directory (or the shared route form) and the app still compiles while the two platforms silently
 * diverge. So this suite calls the REAL `pathForEntry` from the package the app itself imports and derives
 * the route filename from what it returns.
 *
 * HOW `pathForEntry` IS LOADED, since a plain `import` cannot reach it. This suite is bare
 * `node --experimental-strip-types`, and the only form of that function in the package is TypeScript source:
 * `@civfix/ui/nav` maps to `src/nav/index.ts`, whose extensionless relative imports node's ESM resolver
 * rejects outright (and which pulls the RN nav store in anyway), and the pure `src/nav/routes.ts` is not in
 * the package's `exports`. Importing it BY PATH is what fails in release configuration: node refuses to
 * strip types for any file whose realpath is inside node_modules (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING),
 * so a dev LINK checkout — where the symlink's realpath escapes node_modules — would pass while a registry
 * install fails. `loadNavRoutes` therefore resolves the package, reads that one source file, and transpiles
 * it in memory with the app's own `typescript` (the compiler `pnpm typecheck` already requires) before
 * importing it as a data: URL. `src/nav/routes.ts` is self-contained apart from a type-only import, so it
 * needs no module resolution at all once transpiled; a future runtime import there would fail this suite
 * loudly rather than silently stop pinning anything.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "app")

/** `pathForEntry(entry)` — the shared web+mobile URL for a nav entry. `entry` is a @civfix/ui DetailEntry. */
type PathForEntry = (entry: unknown) => string

async function loadNavRoutes(): Promise<{ pathForEntry: PathForEntry }> {
  const require = createRequire(import.meta.url)
  // Resolved through the package specifier (its `exports` publishes "./package.json"), so this follows the
  // SAME @civfix/ui the app imports — the linked workspace copy here, a registry install in CI.
  const routesPath = join(dirname(require.resolve("@civfix/ui/package.json")), "src", "nav", "routes.ts")
  const ts = require("typescript")
  const { outputText } = ts.transpileModule(readFileSync(routesPath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  })
  return import(`data:text/javascript,${encodeURIComponent(outputText)}`)
}

const { pathForEntry } = await loadNavRoutes()

/**
 * The shared URL contract: the nav entry, the `pathForEntry` output that has to stay its URL, the
 * expo-router route file that serves it, and the dynamic segments that file declares (in path order).
 */
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

/** The route file expo-router needs for `url`, derived by substituting each param VALUE with its `[name]`. */
function routeFileForUrl(url: string, params: Readonly<Record<string, string>>): string {
  const segments = url.split("/").filter(Boolean)
  const byValue = new Map(Object.entries(params).map(([name, value]) => [value, `[${name}]`]))
  return `${segments.map((segment) => byValue.get(segment) ?? segment).join("/")}.tsx`
}

for (const route of CHAT_HEADER_ROUTES) {
  test(`${route.label} is served by app/${route.routeFile}`, () => {
    // The LIVE shared URL, straight out of @civfix/ui: change the form in nav/routes.ts and this fails here
    // even if the shared round-trip tests (which are self-consistent under any URL shape) still pass.
    const url = pathForEntry(route.entry)
    assert.equal(url, route.url)
    assert.equal(routeFileForUrl(url, route.params), route.routeFile)
    assert.equal(existsSync(join(APP_DIR, route.routeFile)), true, `missing route file app/${route.routeFile}`)
  })
}

test("the members route is FOUR segments, so it cannot collide with app/messages/[id].tsx", () => {
  // The precedence worry was the static `members` segment against the dynamic `[id]` beside it. There is no
  // contest: `[id]` is a single segment (not a catch-all `[...id]`), so it matches "/messages/<one>" only,
  // and app/messages/dm/[id].tsx already shipped a static sibling at that level.
  assert.equal(pathForEntry({ kind: "members", id: "room-1", roomKind: "cleanup" }).split("/").filter(Boolean).length, 4)
  assert.equal("/messages/room-1".split("/").filter(Boolean).length, 2)
  assert.equal(existsSync(join(APP_DIR, "messages/[id].tsx")), true)
  assert.equal(existsSync(join(APP_DIR, "messages/dm/[id].tsx")), true)
})

test("the shell route app/groups/[id]/info.tsx resets to on leave-group exists", () => {
  // That exit rebuilds the root stack as `SHELL_ROUTE` alone when the chat it was pushed from is the BOTTOM
  // of the stack (a cold `civfix://messages/<id>` open). React Navigation DROPS a reset naming a route the
  // navigator does not have, which would strand the viewer on the info screen — and the route name is just
  // the file name of the shell, `pathForEntry(null)`'s "/".
  assert.equal(pathForEntry(null), "/")
  assert.equal(existsSync(join(APP_DIR, "index.tsx")), true)
})
