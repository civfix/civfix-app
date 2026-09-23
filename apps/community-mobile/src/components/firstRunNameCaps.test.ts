// APP-BUG-251: two 40-char name fields joined by a space can reach 81 chars, past the profile schema's
// 80-char displayName cap, and the save then fails with generic copy. FirstRunGate imports react-native,
// which node --test cannot load, so the guard reads the exact caps and the submit gate.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const gate = readFileSync(new URL("./FirstRunGate.tsx", import.meta.url), "utf8")

test("the first and last name caps plus the joining space fit the 80-char display name", () => {
  assert.match(gate, /const DISPLAY_NAME_MAX = 80\n/)
  assert.match(gate, /const FIRST_NAME_MAX = 40\n/)
  assert.match(gate, /const LAST_NAME_MAX = DISPLAY_NAME_MAX - FIRST_NAME_MAX - 1\n/)
  assert.equal(gate.match(/maxLength=\{FIRST_NAME_MAX\}/g)?.length, 1)
  assert.equal(gate.match(/maxLength=\{LAST_NAME_MAX\}/g)?.length, 1)
})

test("a seeded name longer than the cap cannot be submitted", () => {
  assert.match(gate, /displayName\.length <= DISPLAY_NAME_MAX &&/)
})
