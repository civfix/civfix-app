import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { URL } from "node:url"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

test("the wordmark takes the season's letters and hat for the live scheme", () => {
  const wordmark = read("../src/components/Wordmark.tsx")
  assert.match(wordmark, /const scheme = useColorSchemeName\(\)/)
  assert.match(wordmark, /const colors = wordmarkColorsFor\(scheme\)/)
  assert.match(wordmark, /color=\{colors\[i\]\}/)
  assert.match(wordmark, /<SeasonHat size=\{size\} scheme=\{scheme\} \/>/)
  assert.doesNotMatch(wordmark, /wordmarkColors\b/)
})

test("the boot splash takes the season's letters and hat for the launch scheme", () => {
  const splash = read("../src/components/LoadingSplash.tsx")
  assert.match(splash, /const LETTER_COLORS = wordmarkColorsFor\(LAUNCH_SCHEME\)/)
  assert.match(splash, /color=\{LETTER_COLORS\[i\]\}/)
  assert.match(splash, /hat=\{i === 0 && HAT_ON_C\}/)
  assert.match(splash, /<SeasonHat size=\{fontSize\} scheme=\{LAUNCH_SCHEME\} \/>/)
  assert.doesNotMatch(splash, /wordmarkColors\b/)
})
