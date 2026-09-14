import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { threadEntryRoute } from "./threadEntryRoutes.ts"

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "app")

function routeFileExists(pathname: string): boolean {
  const relative = pathname.replace(/^\//, "")
  return existsSync(join(APP_DIR, `${relative}.tsx`)) || existsSync(join(APP_DIR, relative, "index.tsx"))
}

test("maps every push-capable thread tap to a pushed route", () => {
  assert.deepEqual(threadEntryRoute({ kind: "person", id: "u1" }), {
    pathname: "/people/[id]",
    params: { id: "u1" },
  })
  assert.deepEqual(threadEntryRoute({ kind: "cleanup", id: "c1" }), {
    pathname: "/cleanups/[id]",
    params: { id: "c1" },
  })
  assert.deepEqual(threadEntryRoute({ kind: "pin", id: "r1" }), {
    pathname: "/pin/[id]",
    params: { id: "r1" },
  })
  assert.deepEqual(threadEntryRoute({ kind: "post-thread", id: "p1" }), {
    pathname: "/post/[id]",
    params: { id: "p1" },
  })
  assert.deepEqual(threadEntryRoute({ kind: "org", slug: "acme" }), {
    pathname: "/orgs/[slug]",
    params: { slug: "acme" },
  })
})

test("an org byline on a post opens the organization instead of dropping the tap", () => {
  assert.notEqual(threadEntryRoute({ kind: "org", slug: "river-keepers" }), null)
  assert.equal(threadEntryRoute({ kind: "org" }), null)
  assert.ok(routeFileExists("/orgs/[slug]"))
})

test("maps the quote composer with its target", () => {
  assert.deepEqual(
    threadEntryRoute({ kind: "composer", composerMode: "quote", targetPostId: "p9" }),
    { pathname: "/compose", params: { mode: "quote", targetPostId: "p9" } },
  )
  assert.deepEqual(threadEntryRoute({ kind: "composer" }), { pathname: "/compose", params: {} })
})

test("refuses id-less entries and kinds the thread never produces", () => {
  assert.equal(threadEntryRoute({ kind: "person" }), null)
  assert.equal(threadEntryRoute({ kind: "cleanup" }), null)
  assert.equal(threadEntryRoute({ kind: "pin" }), null)
  assert.equal(threadEntryRoute({ kind: "post-thread" }), null)
  assert.equal(threadEntryRoute({ kind: "profile" }), null)
  assert.equal(threadEntryRoute({ kind: "drop-pin", lat: 1, lng: 2 }), null)
})

test("every mapped pathname has a real expo-router route file", () => {
  const pathnames = [
    threadEntryRoute({ kind: "person", id: "x" }),
    threadEntryRoute({ kind: "cleanup", id: "x" }),
    threadEntryRoute({ kind: "pin", id: "x" }),
    threadEntryRoute({ kind: "post-thread", id: "x" }),
    threadEntryRoute({ kind: "composer", composerMode: "quote", targetPostId: "x" }),
  ].map((route) => {
    assert.notEqual(route, null)
    return route!.pathname
  })
  for (const pathname of pathnames) {
    assert.ok(routeFileExists(pathname), `missing route file for ${pathname}`)
  }
})
