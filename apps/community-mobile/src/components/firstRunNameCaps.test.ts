// APP-BUG-251: two 40-char name fields joined by a space can reach 81 chars, past the profile schema's
// 80-char displayName cap, and the save then fails with generic copy. FirstRunGate imports react-native,
// which node --test cannot load, so the guard reads the exact caps and the submit gate.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { UpdateProfileRequestSchema } from "@civfix/shared"

const gate = readFileSync(new URL("./FirstRunGate.tsx", import.meta.url), "utf8")

function constant(name: string): number {
  const match = new RegExp(`const ${name} = (\\d+)\\n`).exec(gate)
  assert.ok(match, `${name} is no longer a numeric literal`)
  return Number(match[1])
}

test("the display-name cap is the one the profile save validates against", () => {
  const serverMax = UpdateProfileRequestSchema.shape.displayName.maxLength
  assert.equal(typeof serverMax, "number")
  assert.equal(constant("DISPLAY_NAME_MAX"), serverMax)
})

test("the first and last name caps plus the joining space fit the display name cap", () => {
  assert.ok(constant("FIRST_NAME_MAX") < constant("DISPLAY_NAME_MAX") - 1)
  assert.match(gate, /const LAST_NAME_MAX = DISPLAY_NAME_MAX - FIRST_NAME_MAX - 1\n/)
  assert.equal(gate.match(/maxLength=\{FIRST_NAME_MAX\}/g)?.length, 1)
  assert.equal(gate.match(/maxLength=\{LAST_NAME_MAX\}/g)?.length, 1)
})

test("a seeded name longer than the cap cannot be submitted", () => {
  const start = gate.indexOf("const canSubmit =")
  assert.ok(start > -1, "the submit gate is gone")
  const end = gate.indexOf("\n\n", start)
  assert.ok(end > start)
  assert.match(gate.slice(start, end), /\n\s+displayName\.length <= DISPLAY_NAME_MAX &&\n/)
})
