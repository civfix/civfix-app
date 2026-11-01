import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { URL } from "node:url"

const home = readFileSync(new URL("../app/index.tsx", import.meta.url), "utf8")

// Below the system notice the map reads a top inset of 0, so the camera budgets the map's own height.
test("the drop-pin camera aims at the map's height, the window less the system notice", () => {
  assert.match(home, /const windowHeight = useShellWindowHeight\(\)/)
  assert.doesNotMatch(home, /height: windowHeight/)
})
