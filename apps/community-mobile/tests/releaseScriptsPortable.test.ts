import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { URL } from "node:url"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

const patches = read("../scripts/android-release-patches.sh")
const prep = read("../scripts/prep-archive.sh")

test("the Android SDK path is never one machine's Homebrew prefix", () => {
  assert.doesNotMatch(patches, /\/opt\/homebrew/)
  assert.match(patches, /\$\(brew --prefix\)\/share\/android-commandlinetools/)
  assert.match(patches, /command -v brew/)
})

test("with neither the override nor Homebrew, the patch script stops and names the variable", () => {
  assert.match(patches, /Set CIVFIX_ANDROID_SDK_DIR/)
})

test("the archive hand-off names the JDK the Gradle wrapper actually needs", () => {
  assert.doesNotMatch(prep, /JDK 20\b/)
  assert.match(prep, /JDK 22/)
})

test("the baked-config banner does not list the workspace packages as separately installed", () => {
  assert.doesNotMatch(prep, /for \(const dep of \["@civfix\/ui", "@civfix\/shared"\]\)/)
  assert.doesNotMatch(prep, /package\.json wants/)
})
