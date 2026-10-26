import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { URL } from "node:url"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

test("T32: the first-run gate submits through the shared sign-up acceptance step", () => {
  const gate = read("../src/components/FirstRunGate.tsx")
  assert.match(gate, /const completeFirstRun = useCompleteFirstRun\(\)/)
  assert.match(gate, /await completeFirstRun\.mutateAsync\(\{ handle: trimmedHandle, displayName \}\)/)
  assert.doesNotMatch(gate, /updateProfile/)
})

test("T33: the legal update gate renders right after the first-run gate", () => {
  const layout = read("../app/_layout.tsx")
  assert.match(layout, /<FirstRunGate \/>\n\s*<LegalUpdateGate \/>/)
})
