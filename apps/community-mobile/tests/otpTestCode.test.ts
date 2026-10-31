import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { URL } from "node:url"
import { defined } from "./helpers/defined.ts"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const otp = read("../app/auth/otp.tsx")
const en = JSON.parse(
  read("../../../packages/ui/src/i18n/locales/en/mobile-auth-otp.json"),
) as Record<string, unknown>

const count = (source: string, needle: string) => source.split(needle).length - 1

test("T12: the screen offers the test code link exactly where testCodeOffered says", () => {
  assert.match(otp, /^import \{ API_URL \} from "@\/config"$/m)
  assert.match(otp, /^import \{[^}]*\btestCodeOffered\b[^}]*\} from "@\/lib\/developerScreen"$/m)
  assert.equal(count(otp, "testCodeOffered("), 1, "one call decides the link")
  const call = /const (\w+) = testCodeOffered\(email, API_URL, __DEV__\)/.exec(otp)
  assert.ok(call, "the screen calls testCodeOffered(email, API_URL, __DEV__)")
  const offered = defined(call[1], "the name testCodeOffered's result is kept under")
  assert.equal(count(otp, "__DEV__"), 1, "no other development check")
  assert.equal(count(otp, "API_URL"), 2, "API_URL is only imported and passed on")
  assert.doesNotMatch(otp, /civfix\.org|endsWith\(/, "no address rule of the screen's own")

  const link = otp.indexOf('t("test_code.use_test_code")')
  assert.ok(link > -1, "the screen renders the Use a test code link")
  const opener = `{${offered} ? (`
  const guard = otp.lastIndexOf(opener, link)
  assert.ok(guard > -1, `the link sits under ${opener}`)
  const inside = otp.slice(guard + opener.length, link)
  assert.match(inside, /^\s*<Pressable\b/, "the guard opens straight onto the link")
  assert.doesNotMatch(inside, /(\?|&&)\s*\(/, "no other condition wraps the link")
})

test("T13: reviewer and test-code modes share one long-code field", () => {
  assert.equal(count(otp, "<TextField"), 1)
  const start = otp.indexOf("<TextField")
  const field = otp.slice(start, otp.indexOf("/>", start))
  assert.match(field, /maxLength=\{REVIEWER_OTP_CODE_MAX_LENGTH\}/)
  assert.match(field, /autoCapitalize="none"/)
  assert.match(field, /autoCorrect=\{false\}/)
  assert.match(field, /autoComplete="off"/)
})

test("T14: the en catalog carries the test_code strings and leaves the reviewer ones alone", () => {
  assert.deepEqual(en["test_code"], {
    subtitle: "Enter the test account code for",
    label: "Test account code",
    placeholder: "Paste the test code",
    helper: "The shared code for staging test accounts.",
    too_short: "Enter the full test account code.",
    use_test_code: "Use a test code",
    use_emailed_code: "Use the emailed code",
  })
  assert.deepEqual(en["reviewer"], {
    subtitle: "Enter the reviewer access code for",
    label: "Reviewer access code",
    placeholder: "Paste the access code",
    helper: "Provided with this build for app review.",
  })
  assert.equal(
    (en["verify"] as Record<string, unknown>)["too_short"],
    "Enter the full reviewer access code.",
  )
})
