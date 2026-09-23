import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const store = readFileSync(new URL("../src/store/authStore.ts", import.meta.url), "utf8")

function functionBody(name: string): string {
  const start = store.indexOf(`function ${name}(`)
  assert.ok(start > -1, `authStore.ts no longer defines ${name}`)
  const end = store.indexOf("\n}\n", start)
  assert.ok(end > start)
  return store.slice(start, end)
}

test("every identity change reaches the post composer, so a draft never outlives its account", () => {
  assert.match(store, /import \{ adoptPostComposerViewer, discardPostComposerDraft \} from "@civfix\/ui"/)
  assert.match(
    store,
    /useAuthStore\.subscribe\(\(state\) => adoptPostComposerViewer\(state\.user\?\.id \?\? null\)\)/,
  )
})

test("a confirmed identity teardown wipes the draft; a transient unauthed state only hides it", () => {
  assert.match(functionBody("tearDownIdentity"), /\n  discardPostComposerDraft\(\)\n/)
  assert.equal(store.match(/discardPostComposerDraft\(\)/g)?.length, 1)
})
