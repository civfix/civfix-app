import { describe, it, expect } from "vitest"
import {
  AppError,
  ErrorCode,
  ERROR_HTTP_STATUS,
  appErrorCode,
  appErrorFields,
  byErrorCode,
  errorCopyKey,
  isAppErrorLike,
  toAppError,
} from "../src/types/errors.js"
import { AppErrorSchema } from "../src/schemas/common.js"

class ForeignAppError extends Error {
  readonly code: ErrorCode
  readonly httpStatus: number
  readonly fields?: Record<string, unknown>
  readonly requestId?: string

  constructor(
    code: ErrorCode,
    message: string,
    opts: { fields?: Record<string, unknown>; requestId?: string } = {},
  ) {
    super(message)
    this.name = "AppError"
    this.code = code
    this.httpStatus = ERROR_HTTP_STATUS[code]
    if (opts.fields !== undefined) this.fields = opts.fields
    if (opts.requestId !== undefined) this.requestId = opts.requestId
  }
}

describe("AppError", () => {
  it("maps each code to the documented http status", () => {
    expect(AppError.unauthorized().httpStatus).toBe(401)
    expect(AppError.forbidden().httpStatus).toBe(403)
    expect(AppError.notFound().httpStatus).toBe(404)
    expect(AppError.validation().httpStatus).toBe(422)
    expect(AppError.rateLimited().httpStatus).toBe(429)
    expect(AppError.conflict().httpStatus).toBe(409)
    expect(AppError.internal().httpStatus).toBe(500)
    expect(AppError.turnstileFailed().httpStatus).toBe(403)
    expect(AppError.gpsImplausible().httpStatus).toBe(422)
    expect(AppError.mediaRejected().httpStatus).toBe(422)
  })

  it("ERROR_HTTP_STATUS covers every ErrorCode", () => {
    for (const code of Object.values(ErrorCode)) {
      expect(typeof ERROR_HTTP_STATUS[code]).toBe("number")
    }
  })

  it("maps the API-version error codes to their http status", () => {
    expect(AppError.unsupportedApiVersion().httpStatus).toBe(400)
    expect(AppError.unsupportedApiVersion().code).toBe(ErrorCode.UNSUPPORTED_API_VERSION)
    expect(AppError.apiVersionSunset().httpStatus).toBe(410)
    expect(AppError.apiVersionSunset().code).toBe(ErrorCode.API_VERSION_SUNSET)
  })

  it("round-trips the API-version error codes through the wire envelope", () => {
    for (const code of [ErrorCode.UNSUPPORTED_API_VERSION, ErrorCode.API_VERSION_SUNSET]) {
      const json = new AppError(code, "version problem").toJSON()
      const parsed = AppErrorSchema.safeParse(json)
      expect(parsed.success).toBe(true)
      expect(parsed.success && parsed.data.code).toBe(code)
    }
  })

  it("carries validation fields", () => {
    const err = AppError.validation({ email: "invalid" })
    expect(err.code).toBe(ErrorCode.VALIDATION)
    expect(err.fields).toEqual({ email: "invalid" })
  })

  it("is a real Error / instanceof works", () => {
    const err = AppError.notFound("missing")
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(AppError)
    expect(err.message).toBe("missing")
  })

  it("serializes to the wire envelope and validates against AppErrorSchema", () => {
    const err = new AppError(ErrorCode.VALIDATION, "bad", {
      fields: { x: "y" },
      requestId: "req-1",
    })
    const json = err.toJSON()
    expect(json).toEqual({
      code: ErrorCode.VALIDATION,
      message: "bad",
      requestId: "req-1",
      fields: { x: "y" },
    })
    expect(AppErrorSchema.safeParse(json).success).toBe(true)
  })
})

describe("toAppError", () => {
  it("returns the same instance for a real AppError", () => {
    const err = AppError.notFound("missing")
    expect(toAppError(err)).toBe(err)
  })

  it("preserves the code of an AppError thrown by a DUPLICATE module instance", () => {
    const foreign = new ForeignAppError(ErrorCode.NOT_FOUND, "no such certificate", {
      requestId: "req-9",
    })
    expect(foreign).not.toBeInstanceOf(AppError)

    const normalized = toAppError(foreign)
    expect(normalized).toBeInstanceOf(AppError)
    expect(normalized.code).toBe(ErrorCode.NOT_FOUND)
    expect(normalized.httpStatus).toBe(404)
    expect(normalized.message).toBe("no such certificate")
    expect(normalized.requestId).toBe("req-9")
    expect(normalized.cause).toBe(foreign)
  })

  it("preserves validation fields carried by a foreign-instance AppError", () => {
    const foreign = { code: ErrorCode.VALIDATION, message: "bad", fields: { email: "invalid" } }
    const normalized = toAppError(foreign)
    expect(normalized.code).toBe(ErrorCode.VALIDATION)
    expect(normalized.fields).toEqual({ email: "invalid" })
  })

  it("drops non-string fields carried by a DUPLICATE module instance", () => {
    const foreign = new ForeignAppError(ErrorCode.VALIDATION, "bad", {
      fields: { email: "invalid", attempts: 3, meta: { nested: true }, missing: null },
    })
    expect(foreign).not.toBeInstanceOf(AppError)

    const normalized = toAppError(foreign)
    expect(normalized.code).toBe(ErrorCode.VALIDATION)
    expect(normalized.fields).toEqual({ email: "invalid" })
  })

  it("keeps string entries and drops non-string ones from a mixed-type fields bag", () => {
    const normalized = toAppError({
      code: ErrorCode.VALIDATION,
      message: "bad",
      fields: { email: "invalid", attempts: 3, meta: { nested: true }, missing: null },
    })
    expect(normalized.fields).toEqual({ email: "invalid" })
  })

  it("omits fields when a fields bag holds no string entries, or is not an object", () => {
    expect(
      toAppError({ code: ErrorCode.VALIDATION, message: "bad", fields: { attempts: 3 } }).fields,
    ).toBeUndefined()
    expect(
      toAppError({ code: ErrorCode.VALIDATION, message: "bad", fields: ["email"] }).fields,
    ).toBeUndefined()
  })

  it("falls back to a usable message when the envelope carries an empty one", () => {
    expect(toAppError({ code: ErrorCode.INTERNAL, message: "" }).message).toBe("Unknown error")
  })

  it("recognises every ErrorCode structurally", () => {
    for (const code of Object.values(ErrorCode)) {
      expect(toAppError({ code, message: "x" }).code).toBe(code)
    }
  })

  it("does not mistake a foreign error carrying an unrelated code for an AppError", () => {
    const nodeError = Object.assign(new Error("no such file"), { code: "ENOENT" })
    expect(isAppErrorLike(nodeError)).toBe(false)
    expect(toAppError(nodeError).code).toBe(ErrorCode.INTERNAL)
  })

  it("wraps plain errors and non-errors as INTERNAL", () => {
    expect(toAppError(new Error("boom")).code).toBe(ErrorCode.INTERNAL)
    expect(toAppError(new Error("boom")).message).toBe("boom")
    expect(toAppError("boom").code).toBe(ErrorCode.INTERNAL)
    expect(toAppError(null).message).toBe("Unknown error")
    expect(toAppError({ code: "NOT_A_CODE", message: "x" }).code).toBe(ErrorCode.INTERNAL)
  })
})

describe("isAppErrorLike", () => {
  it("accepts any object carrying a known ErrorCode and a string message", () => {
    expect(isAppErrorLike({ code: ErrorCode.CONFLICT, message: "Already exists" })).toBe(true)
  })

  it("rejects an unknown code, a non-string message, and non-objects", () => {
    expect(isAppErrorLike({ code: "ENOENT", message: "no such file" })).toBe(false)
    expect(isAppErrorLike({ code: ErrorCode.CONFLICT, message: 42 })).toBe(false)
    expect(isAppErrorLike(null)).toBe(false)
    expect(isAppErrorLike("CONFLICT")).toBe(false)
  })
})

describe("toAppError over foreign and wire shapes", () => {
  it("normalizes a foreign AppError instance to its real code, status and request id", () => {
    const foreign = Object.assign(new ForeignAppError(ErrorCode.RATE_LIMITED, "Slow down"), {
      httpStatus: 429,
      requestId: "req-1",
    })
    const normalized = toAppError(foreign)

    expect(normalized).toBeInstanceOf(AppError)
    expect(normalized.code).toBe(ErrorCode.RATE_LIMITED)
    expect(normalized.message).toBe("Slow down")
    expect(normalized.httpStatus).toBe(429)
    expect(normalized.requestId).toBe("req-1")
    expect(normalized.cause).toBe(foreign)
  })

  it("keeps only the string fields carried by a foreign AppError instance", () => {
    const foreign = new ForeignAppError(ErrorCode.VALIDATION, "bad", {
      fields: { title: "Too short", count: 3, nested: { a: 1 }, blank: null },
    })

    expect(foreign).not.toBeInstanceOf(AppError)
    expect(toAppError(foreign).fields).toEqual({ title: "Too short" })
  })

  it("normalizes a plain wire-shaped envelope with the code's status", () => {
    const normalized = toAppError({ code: "VALIDATION", message: "Check your input" })
    expect(normalized.code).toBe(ErrorCode.VALIDATION)
    expect(normalized.httpStatus).toBe(422)
  })

  it("keeps string fields and drops non-string ones", () => {
    const normalized = toAppError({
      code: ErrorCode.VALIDATION,
      message: "Check your input",
      fields: { title: "Too short", count: 3, nested: { a: 1 }, blank: null },
    })
    expect(normalized.fields).toEqual({ title: "Too short" })
  })

  it("omits fields entirely when none of them are strings, or when fields is not an object", () => {
    expect(
      toAppError({ code: ErrorCode.VALIDATION, message: "Check your input", fields: { count: 3 } })
        .fields,
    ).toBeUndefined()
    expect(
      toAppError({ code: ErrorCode.VALIDATION, message: "Check your input", fields: ["title"] })
        .fields,
    ).toBeUndefined()
  })

  it("falls through to INTERNAL for a Node errno-style error, keeping its message and cause", () => {
    const errno = Object.assign(new Error("no such file"), { code: "ENOENT" })
    const normalized = toAppError(errno)
    expect(normalized.code).toBe(ErrorCode.INTERNAL)
    expect(normalized.message).toBe("no such file")
    expect(normalized.cause).toBe(errno)
  })

  it("wraps a plain network Error as INTERNAL", () => {
    const normalized = toAppError(new TypeError("Failed to fetch"))
    expect(normalized.code).toBe(ErrorCode.INTERNAL)
    expect(normalized.message).toBe("Failed to fetch")
  })

  it("wraps a thrown non-Error value as INTERNAL with a diagnostic message", () => {
    expect(toAppError("boom").code).toBe(ErrorCode.INTERNAL)
    expect(toAppError("boom").message).toBe("Unknown error")
  })
})

describe("appErrorCode", () => {
  it("reads the code of a real AppError and of a foreign-instance one", () => {
    expect(appErrorCode(AppError.conflict())).toBe(ErrorCode.CONFLICT)
    expect(appErrorCode(new ForeignAppError(ErrorCode.RATE_LIMITED, "slow down"))).toBe(
      ErrorCode.RATE_LIMITED,
    )
    expect(appErrorCode({ name: "AppError", code: "RATE_LIMITED", message: "slow down" })).toBe(
      ErrorCode.RATE_LIMITED,
    )
  })

  it("reads a plain wire envelope", () => {
    expect(appErrorCode({ code: ErrorCode.NOT_FOUND, message: "gone" })).toBe(ErrorCode.NOT_FOUND)
  })

  it("is undefined for anything the contract does not recognise as an AppError", () => {
    expect(appErrorCode(new TypeError("Failed to fetch"))).toBeUndefined()
    expect(appErrorCode(Object.assign(new Error("no such file"), { code: "ENOENT" }))).toBeUndefined()
    expect(appErrorCode({ name: "AppError", code: "SOMETHING_NEW", message: "x" })).toBeUndefined()
    expect(appErrorCode({ name: "AppError", code: "RATE_LIMITED" })).toBeUndefined()
    expect(appErrorCode("RATE_LIMITED")).toBeUndefined()
    expect(appErrorCode(null)).toBeUndefined()
    expect(appErrorCode(undefined)).toBeUndefined()
  })
})

describe("appErrorFields", () => {
  it("reads the fields of a real AppError and of a foreign-instance one", () => {
    expect(appErrorFields(AppError.validation({ email: "invalid" }))).toEqual({ email: "invalid" })
    const foreign = new ForeignAppError(ErrorCode.VALIDATION, "bad", {
      fields: { event: "ended", attempts: 3 },
    })
    expect(appErrorFields(foreign)).toEqual({ event: "ended" })
  })

  it("is undefined when there are no string fields or the value is not an AppError", () => {
    expect(appErrorFields(AppError.conflict())).toBeUndefined()
    expect(appErrorFields({ code: ErrorCode.VALIDATION, message: "bad", fields: {} })).toBeUndefined()
    expect(appErrorFields({ code: ErrorCode.VALIDATION, message: "bad", fields: ["email"] })).toBeUndefined()
    expect(appErrorFields({ fields: { email: "invalid" } })).toBeUndefined()
    expect(appErrorFields(new Error("boom"))).toBeUndefined()
  })
})

describe("byErrorCode", () => {
  const table = {
    [ErrorCode.RATE_LIMITED]: "copy.rate_limited",
    [ErrorCode.VALIDATION]: "",
  }

  it("returns the table entry for a mapped code", () => {
    expect(byErrorCode(ErrorCode.RATE_LIMITED, table, "copy.generic")).toBe("copy.rate_limited")
    expect(byErrorCode("RATE_LIMITED", table, "copy.generic")).toBe("copy.rate_limited")
  })

  it("treats an empty-string entry as a real value, not a fallthrough", () => {
    expect(byErrorCode(ErrorCode.VALIDATION, table, "copy.generic")).toBe("")
  })

  it("falls back for an unmapped, unknown, missing or prototype-named code", () => {
    expect(byErrorCode(ErrorCode.CONFLICT, table, "copy.generic")).toBe("copy.generic")
    expect(byErrorCode("SOMETHING_NEW", table, "copy.generic")).toBe("copy.generic")
    expect(byErrorCode(undefined, table, "copy.generic")).toBe("copy.generic")
    expect(byErrorCode("toString", table, "copy.generic")).toBe("copy.generic")
  })
})

describe("errorCopyKey", () => {
  const table = { [ErrorCode.RATE_LIMITED]: "copy.rate_limited" }

  it("maps a real or foreign-instance AppError by its code, never by its message", () => {
    expect(errorCopyKey(AppError.rateLimited("raw server text"), table, "copy.generic")).toBe(
      "copy.rate_limited",
    )
    expect(
      errorCopyKey(new ForeignAppError(ErrorCode.RATE_LIMITED, "raw"), table, "copy.generic"),
    ).toBe("copy.rate_limited")
    expect(errorCopyKey(AppError.conflict("Already exists."), table, "copy.generic")).toBe(
      "copy.generic",
    )
  })

  it("reads a transport failure or a thrown non-error as the fallback", () => {
    expect(errorCopyKey(new TypeError("network down"), table, "copy.generic")).toBe("copy.generic")
    expect(errorCopyKey("weird", table, "copy.generic")).toBe("copy.generic")
  })
})
