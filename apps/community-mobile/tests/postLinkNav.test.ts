import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { isInternalLink } from "../src/lib/links.ts"
import { bridgeKey } from "../src/lib/navBridge.ts"

type RouteEntry = { kind: string; id?: string }

async function loadNavRoutes(): Promise<{
  entryFromPath: (path: string) => RouteEntry | null
  pathForEntry: (entry: RouteEntry) => string
}> {
  const require = createRequire(import.meta.url)
  const routesPath = join(dirname(require.resolve("@civfix/ui/package.json")), "src", "nav", "routes.ts")
  const ts = require("typescript")
  const { outputText } = ts.transpileModule(readFileSync(routesPath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  })
  return import(`data:text/javascript,${encodeURIComponent(outputText)}`)
}

const { entryFromPath, pathForEntry } = await loadNavRoutes()
const adapter = readFileSync(new URL("../src/components/MobileNavAdapter.tsx", import.meta.url), "utf8")

test("a /post/<id> notification or chat link opens the in-shell post page, not the bridged thread route", () => {
  assert.equal(isInternalLink("/post/p1"), true)
  const entry = entryFromPath("/post/p1")
  assert.deepEqual(entry, { kind: "post", id: "p1" })
  assert.equal(bridgeKey(entry as never), null)
})

test("only the explicit /thread address bridges to the native post thread route", () => {
  const entry = entryFromPath("/post/p1/thread")
  assert.deepEqual(entry, { kind: "post-thread", id: "p1" })
  assert.equal(bridgeKey(entry as never), "post-thread:p1")
  assert.equal(pathForEntry({ kind: "post-thread", id: "p1" }), "/post/p1/thread")
})

test("applyInternalHref resolves hrefs through the shared parser and bridges by that entry", () => {
  const apply = adapter.slice(adapter.indexOf("export function applyInternalHref"))
  const body = apply.slice(0, apply.indexOf("\n}"))
  assert.match(body, /const entry = entryFromPath\(href\)/)
  assert.match(body, /const key = bridgeKey\(entry\)/)
})
