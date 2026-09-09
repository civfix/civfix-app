import { describe, it, expect } from "vitest"
import {
  AppError,
  ErrorCode,
  ERROR_HTTP_STATUS,
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
