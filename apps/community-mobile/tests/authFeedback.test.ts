import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const otp = read("../app/auth/otp.tsx")
const authOptions = read("../src/components/AuthOptions.tsx")
const firstRun = read("../src/components/FirstRunGate.tsx")

test("every sign-in error row is announced to screen readers when it appears", () => {
  for (const [name, source] of [
    ["otp", otp],
    ["AuthOptions", authOptions],
    ["FirstRunGate", firstRun],
  ] as const) {
    assert.match(source, /useEffect\(\(\) => \{\s*if \(error\) announce\(error\)\s*\}, \[error\]\)/, name)
    assert.doesNotMatch(source, /accessibilityLiveRegion/, `${name}: a live region would double-announce on Android`)
  }
})

test("the OTP screen never interpolates the server's raw message into its localized copy", () => {
  assert.doesNotMatch(otp, /errorMessage\(/)
  assert.match(otp, /const reason = codeRejectionReason\(t, err, t\("verify\.fallback_reason"\)\)/)
})

function onSubmitBody(): string {
  const start = firstRun.indexOf("const onSubmit = useCallback(")
  return firstRun.slice(start, firstRun.indexOf("\n  }, [", start))
}

test("the first-run form always clears its spinner once the profile save settles", () => {
  assert.match(onSubmitBody(), /\} finally \{\s*setSubmitting\(false\)\s*\}/)
})

test("a failed username check says so and offers a retry instead of leaving Continue dead", () => {
  const check = firstRun.slice(firstRun.indexOf("const res = await api.checkHandle"))
  assert.match(check.slice(0, check.indexOf("}, 350)")), /catch \{\s*if \(!cancelled\) setAvail\(\{ \.\.\.UNCHECKED, failed: true \}\)/)
  assert.match(firstRun, /\}, \[trimmedHandle, handleValid, checkAttempt\]\)/)
  assert.match(firstRun, /checkFailed=\{handleValid && avail\.failed\}/)
  assert.match(firstRun, /onRetry=\{retryHandleCheck\}/)

  const hint = firstRun.slice(firstRun.indexOf("function HandleHint("))
  assert.match(hint, /content = t\("handle\.check_failed"\)/)
  assert.match(hint, /onPress=\{onRetry\}/)
  assert.match(hint, /\{t\("handle\.retry"\)\}/)
})
