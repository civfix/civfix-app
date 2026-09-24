import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { URL } from "node:url"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const store = read("../src/store/authStore.ts")
const webAuth = read("../../community-web/src/hooks/use-auth.ts")

function listBody(source: string, name: string): string {
  const start = source.indexOf(`const ${name}`)
  assert.ok(start > -1, `${name} is gone`)
  const end = source.indexOf("\n]", start)
  assert.ok(end > start)
  return source.slice(start, end)
}

function keyEntries(body: string): string[] {
  return [...body.matchAll(/^\s+(queryKeys\.\w+|\[[^\]]*\]),?$/gm)].map((m) => m[1]!)
}

test("signing in refetches what a guest cached with guest-only liked, saved and joined flags", () => {
  const signInStart = store.indexOf("signIn: async (token, user) => {")
  assert.ok(signInStart > -1)
  const signInEnd = store.indexOf("\n  },", signInStart)
  assert.ok(signInEnd > signInStart)
  assert.match(
    store.slice(signInStart, signInEnd),
    /adoptIdentity\(user, set\)\s*invalidateViewerDependentQueries\(\)/,
  )
  const keys = keyEntries(listBody(store, "VIEWER_DEPENDENT_KEYS"))
  assert.ok(keys.includes("queryKeys.postsRoot"))
  assert.ok(keys.includes("queryKeys.postRoot"))
})

test("mobile refreshes at least every family the web refreshes on sign-in", () => {
  const web = keyEntries(listBody(webAuth, "AUTH_DEPENDENT_KEYS"))
  assert.ok(web.length > 0)
  const mobile = new Set(keyEntries(listBody(store, "VIEWER_DEPENDENT_KEYS")))
  for (const key of web) assert.ok(mobile.has(key), key)
})
