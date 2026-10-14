import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { URL } from "node:url"
import { isInternalLink } from "../src/lib/links.ts"
import { bridgeKey } from "../src/lib/navBridge.ts"
import { loadNavRoutes } from "./helpers/navRoutes.ts"

type RouteEntry = { kind: string; id?: string }

const { entryFromPath, pathForEntry } = await loadNavRoutes<{
  entryFromPath: (path: string) => RouteEntry | null
  pathForEntry: (entry: RouteEntry) => string
}>()
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
