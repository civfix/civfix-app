import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { URL } from "node:url"

const store = readFileSync(new URL("../src/store/authStore.ts", import.meta.url), "utf8")

function functionBody(name: string): string {
  const start = store.indexOf(`function ${name}(`)
  assert.ok(start > -1, `authStore.ts no longer defines ${name}`)
  const end = store.indexOf("\n}\n", start)
  assert.ok(end > start)
  return store.slice(start, end)
}

test("every identity change reaches the @civfix/ui draft registry, so no draft outlives its account", () => {
  assert.match(store, /import \{ adoptViewer, discardViewerDrafts \} from "@civfix\/ui"/)
  assert.match(store, /useAuthStore\.subscribe\(\(state\) => adoptViewer\(state\.user\?\.id \?\? null\)\)/)
  assert.doesNotMatch(store, /PostComposer/)
})

test("a confirmed identity teardown wipes every draft; a transient unauthed state keeps them", () => {
  assert.match(functionBody("tearDownIdentity"), /\n  discardViewerDrafts\(\)\n/)
  assert.equal(store.match(/discardViewerDrafts\(\)/g)?.length, 1)
})
