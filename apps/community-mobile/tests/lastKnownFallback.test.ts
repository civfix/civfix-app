import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

const READERS = [
  "../src/lib/nativeGeolocation.ts",
  "../src/hooks/useUserLocation.ts",
  "../src/components/report/ReportViewfinder.tsx",
]

const LAST_KNOWN = /Location\.getLastKnownPositionAsync\(\{\s*maxAge: LAST_KNOWN_MAX_AGE_MS,?\s*\}\)(\.catch\(\(\) => null\))?/g

for (const file of READERS) {
  test(`${file}: a failed cached read falls through to a fresh fix instead of giving up`, () => {
    const calls = [...read(file).matchAll(LAST_KNOWN)]
    assert.ok(calls.length > 0, "expected a cached-position read")
    for (const call of calls) assert.ok(call[1], `uncaught cached read: ${call[0]}`)
  })
}

test("the fallback adds no permission prompt to the hook's passive read", () => {
  const hook = read("../src/hooks/useUserLocation.ts")
  const readFix = hook.slice(hook.indexOf("const readFix"), hook.indexOf("const refresh"))
  assert.doesNotMatch(readFix, /requestForegroundPermissionsAsync/)
})
