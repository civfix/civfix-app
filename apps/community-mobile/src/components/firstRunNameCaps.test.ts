// Two 40-char name fields joined by a space can reach 81 chars, past the profile schema's
// 80-char displayName cap, and the save then fails with generic copy. The caps and the submit rule live in
// @civfix/ui's firstRunModel (behaviourally tested there); FirstRunGate imports react-native, which
// node --test cannot load, so this guard pins that the gate uses those caps and that rule.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const gate = readFileSync(new URL("./FirstRunGate.tsx", import.meta.url), "utf8")

test("the name fields take their caps from the shared first-run model", () => {
  assert.match(gate, /\n  FIRST_NAME_MAX,\n  LAST_NAME_MAX,\n[\s\S]*?\} from "@civfix\/ui\/data"/)
  assert.doesNotMatch(gate, /const (DISPLAY|FIRST|LAST)_NAME_MAX = /)
  assert.equal(gate.match(/maxLength=\{FIRST_NAME_MAX\}/g)?.length, 1)
  assert.equal(gate.match(/maxLength=\{LAST_NAME_MAX\}/g)?.length, 1)
})

test("Continue is gated by the shared model's submit rule", () => {
  assert.match(gate, /canSubmit,\n  \} = firstRunModel\(\{/)
  assert.match(gate, /if \(!canSubmit\) return/)
  assert.match(gate, /disabled=\{!canSubmit\}/)
})
