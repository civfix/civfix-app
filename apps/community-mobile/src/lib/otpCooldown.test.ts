import { test } from "node:test"
import assert from "node:assert/strict"
import {
  DEFAULT_RESEND_COOLDOWN_SEC,
  canResend,
  parseResendAfterSec,
  resendDeadline,
  resendSecondsLeft,
} from "./otpCooldown.ts"

test("the server's resendAfterSec wins; anything unusable falls back to the default", () => {
  assert.equal(parseResendAfterSec("45"), 45)
  assert.equal(parseResendAfterSec("45.9"), 45)
  assert.equal(parseResendAfterSec(undefined), DEFAULT_RESEND_COOLDOWN_SEC)
  assert.equal(parseResendAfterSec(""), DEFAULT_RESEND_COOLDOWN_SEC)
  assert.equal(parseResendAfterSec("0"), DEFAULT_RESEND_COOLDOWN_SEC)
  assert.equal(parseResendAfterSec("-5"), DEFAULT_RESEND_COOLDOWN_SEC)
  assert.equal(parseResendAfterSec("soon"), DEFAULT_RESEND_COOLDOWN_SEC)
})

test("the cooldown is a wall-clock deadline, not a tick count", () => {
  const deadline = resendDeadline(1_000_000, 30)
  assert.equal(deadline, 1_030_000)
  assert.equal(resendSecondsLeft(deadline, 1_000_000), 30)
  assert.equal(resendSecondsLeft(deadline, 1_010_000), 20)
})

test("time spent backgrounded is counted - the display resyncs from the clock, never resumes", () => {
  const deadline = resendDeadline(0, 30)
  assert.equal(resendSecondsLeft(deadline, 25_000), 5)
  assert.equal(resendSecondsLeft(deadline, 300_000), 0)
})

test("a partial second still reads as a remaining second so the label never lies about 0", () => {
  const deadline = resendDeadline(0, 30)
  assert.equal(resendSecondsLeft(deadline, 29_500), 1)
  assert.equal(resendSecondsLeft(deadline, 30_000), 0)
})

test("the remaining count floors at zero and never goes negative", () => {
  assert.equal(resendSecondsLeft(resendDeadline(0, 5), 60_000), 0)
  assert.equal(resendDeadline(1000, -5), 1000)
})

test("resend is gated on the deadline itself, not on the rendered countdown", () => {
  const deadline = resendDeadline(0, 30)
  assert.equal(canResend(deadline, 0), false)
  assert.equal(canResend(deadline, 29_999), false)
  assert.equal(canResend(deadline, 30_000), true)
})

test("a non-finite deadline degrades to 'resend allowed' rather than a permanent lockout", () => {
  assert.equal(resendSecondsLeft(Number.NaN, 0), 0)
  assert.equal(canResend(Number.NaN, 0), true)
})
