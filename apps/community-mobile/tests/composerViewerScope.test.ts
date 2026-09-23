import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const store = readFileSync(new URL("../src/store/authStore.ts", import.meta.url), "utf8")

test("every identity change reaches the post composer, so a draft never outlives its account", () => {
  assert.match(store, /import \{ adoptPostComposerViewer \} from "@civfix\/ui"/)
  assert.match(
    store,
    /useAuthStore\.subscribe\(\(state\) => adoptPostComposerViewer\(state\.user\?\.id \?\? null\)\)/,
  )
})
