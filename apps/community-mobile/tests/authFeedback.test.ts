import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { URL } from "node:url"
import { MIN_TOUCH_TARGET } from "../../../packages/ui/src/theme/touchTarget.ts"

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
  assert.match(firstRun, /const \{ availability, checkedHandle \} = useHandleAvailabilityCheck\(handle, null\)/)
  assert.match(firstRun, /const \{ refetch: recheckHandle \} = availability/)
  assert.match(firstRun, /const retryHandleCheck = useCallback\(\(\) => void recheckHandle\(\), \[recheckHandle\]\)/)
  assert.match(firstRun, /\} = firstRunModel\(\{/)
  assert.match(firstRun, /checkFailed=\{checkFailed\}/)
  assert.match(firstRun, /onRetry=\{retryHandleCheck\}/)

  const hint = firstRun.slice(firstRun.indexOf("function HandleHint("))
  assert.match(hint, /content = t\("handle\.check_failed"\)/)
  assert.match(hint, /onPress=\{onRetry\}/)
  assert.match(hint, /\{t\("handle\.retry"\)\}/)
})

test("a failed username check is announced, and its retry is a full-size touch target", () => {
  assert.match(
    firstRun,
    /useEffect\(\(\) => \{\s*if \(checkFailed\) announce\(t\("handle\.check_failed"\)\)\s*\}, \[checkFailed, t\]\)/,
  )

  const hintStart = firstRun.indexOf("function HandleHint(")
  assert.ok(hintStart > -1)
  const retryStart = firstRun.indexOf("onPress={onRetry}", hintStart)
  assert.ok(retryStart > hintStart)
  const retryEnd = firstRun.indexOf("</Pressable>", retryStart)
  assert.ok(retryEnd > retryStart)
  const retry = firstRun.slice(retryStart, retryEnd)
  assert.match(retry, /styles\.retryTarget/)
  assert.equal(MIN_TOUCH_TARGET, 44)
  assert.match(firstRun, /import \{[^}]*\bMIN_TOUCH_TARGET\b[^}]*\} from "@\/theme"/)
  assert.doesNotMatch(firstRun, /const MIN_TOUCH_TARGET =/)
  assert.match(firstRun, /retryTarget: \{[^}]*minHeight: MIN_TOUCH_TARGET/)
})
