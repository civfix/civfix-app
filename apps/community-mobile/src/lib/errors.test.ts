import { test } from "node:test"
import assert from "node:assert/strict"
import { AppError, ErrorCode } from "@civfix/shared"
import { parseError } from "@civfix/shared/client"
import { isAppError, isRetryableError } from "./errors.ts"

function crossRealmAppError(code: string, message = "cross-realm"): unknown {
  const err = new Error(message)
  err.name = "AppError"
  return Object.assign(err, { code })
}

async function errorFromTheApiClientRealm(code: string): Promise<unknown> {
  const body = JSON.stringify({ error: { code, message: "from the wire" } })
  const response = new Response(body, {
    status: 401,
    headers: { "content-type": "application/json" },
  })
  return parseError(response)
}

test("the api client's REAL AppError is not instanceof the root one - instanceof cannot be trusted", async () => {
  const thrown = await errorFromTheApiClientRealm(ErrorCode.UNAUTHORIZED)
  assert.equal((thrown as Error).name, "AppError")
  assert.equal((thrown as AppError).code, ErrorCode.UNAUTHORIZED)
  assert.equal(thrown instanceof AppError, false)
  assert.equal(isAppError(thrown), true)
  assert.equal(isRetryableError(thrown), false)
})

test("the hand-built cross-realm stand-in matches the real one's brand", () => {
  const foreign = crossRealmAppError(ErrorCode.UNAUTHORIZED)
  assert.equal(foreign instanceof AppError, false)
  assert.equal(isAppError(foreign), true)
})

test("a real AppError with a terminal code is never retried", () => {
  for (const code of [
    ErrorCode.UNAUTHORIZED,
    ErrorCode.FORBIDDEN,
    ErrorCode.NOT_FOUND,
    ErrorCode.VALIDATION,
  ]) {
    assert.equal(isRetryableError(new AppError(code, "no")), false, code)
  }
})

test("a CROSS-REALM AppError with a terminal code is not retried either (the defect this fixes)", () => {
  for (const code of [
    ErrorCode.UNAUTHORIZED,
    ErrorCode.FORBIDDEN,
    ErrorCode.NOT_FOUND,
    ErrorCode.VALIDATION,
  ]) {
    assert.equal(isRetryableError(crossRealmAppError(code)), false, code)
  }
})

test("a retryable server/abuse code still retries, in both realms", () => {
  assert.equal(isRetryableError(new AppError(ErrorCode.INTERNAL, "boom")), true)
  assert.equal(isRetryableError(new AppError(ErrorCode.RATE_LIMITED, "slow down")), true)
  assert.equal(isRetryableError(crossRealmAppError(ErrorCode.INTERNAL)), true)
  assert.equal(isRetryableError(crossRealmAppError(ErrorCode.RATE_LIMITED)), true)
})

test("a transport failure is retryable - it is not an AppError at all", () => {
  assert.equal(isRetryableError(new TypeError("Network request failed")), true)
  assert.equal(isRetryableError(new Error("timeout")), true)
  assert.equal(isRetryableError(undefined), true)
  assert.equal(isRetryableError("UNAUTHORIZED"), true)
})

test("an AppError-shaped object with a non-string code is not treated as an AppError", () => {
  const err = new Error("x")
  err.name = "AppError"
  assert.equal(isAppError(Object.assign(err, { code: 401 })), false)
  assert.equal(isRetryableError(Object.assign(err, { code: 401 })), true)
})
