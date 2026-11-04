import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const src = readFileSync(new URL("../scripts/native-fingerprint.mjs", import.meta.url), "utf8")

test("T15: the fingerprint keeps @expo/fingerprint's default preset and the same two source skips", () => {
  const call = /createFingerprintAsync\(appDir, \{\n([\s\S]*?)\n\}\)/.exec(src)
  assert.ok(call, "the createFingerprintAsync(appDir, { ... }) call is gone")
  const options = (call[1] ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  assert.deepEqual(options, [
    'platforms: ["android"],',
    "sourceSkips: SourceSkips.ExpoConfigExtraSection | SourceSkips.ExpoConfigVersions,",
  ])
  assert.equal(src.split("createFingerprintAsync(").length - 1, 1)
})
