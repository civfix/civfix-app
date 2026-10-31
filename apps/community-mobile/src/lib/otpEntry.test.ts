import assert from "node:assert/strict"
import { test } from "node:test"
import { isOtpCodeIncomplete } from "./otpEntry.ts"

const chars = (n: number) => "a".repeat(n)

test("T8: a test code needs at least 20 characters, up to 128", () => {
  assert.equal(isOtpCodeIncomplete(chars(19), "test_code"), true)
  assert.equal(isOtpCodeIncomplete(chars(20), "test_code"), false)
  assert.equal(isOtpCodeIncomplete(chars(128), "test_code"), false)
})

test("T9: a test code is trimmed before counting", () => {
  assert.equal(isOtpCodeIncomplete(`  ${chars(19)}  `, "test_code"), true)
  assert.equal(isOtpCodeIncomplete(`  ${chars(20)}  `, "test_code"), false)
})

test("T10: the reviewer code keeps its rule", () => {
  assert.equal(isOtpCodeIncomplete(chars(19), "reviewer"), true)
  assert.equal(isOtpCodeIncomplete(chars(20), "reviewer"), false)
  assert.equal(isOtpCodeIncomplete(` ${chars(20)} `, "reviewer"), false)
})

test("T11: the emailed code is exactly six characters", () => {
  assert.equal(isOtpCodeIncomplete("123456", "digits"), false)
  assert.equal(isOtpCodeIncomplete("12345", "digits"), true)
  assert.equal(isOtpCodeIncomplete("1234567", "digits"), true)
  assert.equal(isOtpCodeIncomplete(chars(20), "digits"), true)
})
