import assert from "node:assert/strict"
import { test } from "node:test"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const SCRIPT = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "store-build.sh"),
  "utf8",
)

/**
 * The exact reader `store-build.sh` runs over EXConstants.bundle/app.config, lifted out of the script
 * so this test cannot drift from what the release actually asserts.
 */
function bakedApiUrlReader(): string {
  const at = SCRIPT.indexOf("baked_api_url=\"$(printf '%s' \"$baked_config\" | node -e '")
  assert.ok(at > -1, "store-build.sh no longer reads the baked api url with an inline node program")
  const open = SCRIPT.indexOf("node -e '", at) + "node -e '".length
  const close = SCRIPT.indexOf("')\"", open)
  assert.ok(close > open, "the inline node program is unterminated")
  return SCRIPT.slice(open, close)
}

function read(config: unknown): string {
  return execFileSync("node", ["-e", bakedApiUrlReader()], {
    input: JSON.stringify(config),
    encoding: "utf8",
  })
}

/** The appstore target promises an EMPTY expectation: the app resolves its base URL at runtime. */
const APPSTORE_EXPECTATION = ""
const TESTFLIGHT_EXPECTATION = "https://api.civfix.dev"

test("a testflight build reports the API URL that was baked in", () => {
  assert.equal(read({ extra: { apiUrl: TESTFLIGHT_EXPECTATION } }), TESTFLIGHT_EXPECTATION)
})

test("only a genuinely ABSENT apiUrl satisfies the appstore expectation", () => {
  assert.equal(read({ extra: {} }), APPSTORE_EXPECTATION)
  assert.equal(read({}), APPSTORE_EXPECTATION)
  assert.equal(read({ extra: null }), APPSTORE_EXPECTATION)
})

test("the {} Expo bakes for a null config value FAILS the appstore assertion", () => {
  const baked = read({ extra: { apiUrl: {} } })
  assert.equal(baked, "{}")
  assert.notEqual(baked, APPSTORE_EXPECTATION)
})

test("a null, a number and an object all stay distinguishable from absent", () => {
  for (const value of [null, 0, 42, { a: 1 }, []]) {
    assert.notEqual(read({ extra: { apiUrl: value } }), APPSTORE_EXPECTATION)
  }
})

test("a staging URL in an appstore build is refused, and a prod URL in a testflight build too", () => {
  assert.notEqual(read({ extra: { apiUrl: TESTFLIGHT_EXPECTATION } }), APPSTORE_EXPECTATION)
  assert.notEqual(read({ extra: { apiUrl: "https://api.civfix.org" } }), TESTFLIGHT_EXPECTATION)
})
