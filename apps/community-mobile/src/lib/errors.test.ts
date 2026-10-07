import { test } from "node:test"
import assert from "node:assert/strict"
import { AppError, ErrorCode, isAppErrorLike } from "@civfix/shared"
import { parseError } from "@civfix/shared/client"
import { codeRejectionReason, friendlyError, isConflict, isRetryableError } from "./errors.ts"

function crossRealmAppError(code: string, message = "cross-realm"): Error & { code: string } {
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

test("the api client's AppError is the root AppError: one module instance across entries", async () => {
  const thrown = await errorFromTheApiClientRealm(ErrorCode.UNAUTHORIZED)
  assert.equal((thrown as Error).name, "AppError")
  assert.equal((thrown as AppError).code, ErrorCode.UNAUTHORIZED)
  assert.equal(thrown instanceof AppError, true)
  assert.equal(isAppErrorLike(thrown), true)
  assert.equal(isRetryableError(thrown), false)
})

test("the hand-built cross-realm stand-in matches the real one's brand", () => {
  const foreign = crossRealmAppError(ErrorCode.UNAUTHORIZED)
  assert.equal(foreign instanceof AppError, false)
  assert.equal(isAppErrorLike(foreign), true)
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

async function conflictFromTheWire(body: string): Promise<unknown> {
  return parseError(
    new Response(body, { status: 409, headers: { "content-type": "application/json" } }),
  )
}

test("a push-token 409 is recognised as a conflict, enveloped or bare", async () => {
  const enveloped = await conflictFromTheWire(
    JSON.stringify({ error: { code: ErrorCode.CONFLICT, message: "token owned elsewhere" } }),
  )
  assert.equal(isConflict(enveloped), true)
  assert.equal(isConflict(await conflictFromTheWire("<html>nginx</html>")), true)
})

test("a conflict is recognised in BOTH realms and from the status alone", () => {
  assert.equal(isConflict(new AppError(ErrorCode.CONFLICT, "taken")), true)
  assert.equal(isConflict(crossRealmAppError(ErrorCode.CONFLICT)), true)
  assert.equal(
    isConflict(Object.assign(crossRealmAppError(ErrorCode.INTERNAL), { httpStatus: 409 })),
    true,
  )
})

test("nothing else is a conflict - a 401 or a transport failure must stay retryable", () => {
  assert.equal(isConflict(new AppError(ErrorCode.UNAUTHORIZED, "no")), false)
  assert.equal(isConflict(new AppError(ErrorCode.INTERNAL, "boom")), false)
  assert.equal(isConflict(crossRealmAppError(ErrorCode.RATE_LIMITED)), false)
  assert.equal(isConflict(new TypeError("Network request failed")), false)
  assert.equal(isConflict(undefined), false)
})

test("an AppError-shaped object with a non-string code is not treated as an AppError", () => {
  const err = new Error("x")
  err.name = "AppError"
  assert.equal(isAppErrorLike(Object.assign(err, { code: 401 })), false)
  assert.equal(isRetryableError(Object.assign(err, { code: 401 })), true)
})

const echoT = (key: string) => `<${key}>`

test("a rejected code reads as the localized rejection copy, never the server's English text", async () => {
  const wire = await errorFromTheApiClientRealm(ErrorCode.UNAUTHORIZED)
  assert.equal(codeRejectionReason(echoT, wire, "That code did not work."), "That code did not work.")
  assert.equal(
    codeRejectionReason(echoT, new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired code."), "rejected"),
    "rejected",
  )
})

test("any other code failure reads as its localized code copy, and a transport failure as the generic one", () => {
  assert.equal(
    codeRejectionReason(echoT, new AppError(ErrorCode.VALIDATION, "code: must be 6 digits"), "rejected"),
    "<mobile-errors:code.VALIDATION>",
  )
  assert.equal(
    codeRejectionReason(echoT, crossRealmAppError(ErrorCode.INTERNAL, "db down"), "rejected"),
    "<mobile-errors:code.INTERNAL>",
  )
  assert.equal(codeRejectionReason(echoT, new TypeError("Network request failed"), "rejected"), "<mobile-errors:generic>")
})

test("a code the app has copy for reads as that copy; any other failure reads as the generic line", () => {
  assert.equal(friendlyError(echoT, new AppError(ErrorCode.RATE_LIMITED, "raw")), "<mobile-errors:code.RATE_LIMITED>")
  assert.equal(friendlyError(echoT, crossRealmAppError(ErrorCode.FORBIDDEN)), "<mobile-errors:code.FORBIDDEN>")
  assert.equal(friendlyError(echoT, new AppError(ErrorCode.NOT_ROUTABLE, "raw")), "<mobile-errors:generic>")
  assert.equal(friendlyError(echoT, new TypeError("Network request failed")), "<mobile-errors:generic>")
})
