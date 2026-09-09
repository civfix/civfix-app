import { describe, it, expect } from "vitest"
import { AppError, ErrorCode } from "@civfix/shared"
import { createApiClient } from "@civfix/shared/client"

import { isAppErrorLike, toAppError } from "@/lib/api"

function clientRespondingWith(status: number, body: unknown) {
  return createApiClient({
    baseURL: "http://api.test",
    fetchImpl: async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  })
}

async function catchFrom(api: ReturnType<typeof clientRespondingWith>): Promise<unknown> {
  const caught = await api.listBlocks({}).then(
    () => null as unknown,
    (err: unknown) => err,
  )
  expect(caught).toBeInstanceOf(Error)
  expect(caught).not.toBeInstanceOf(AppError)
  return caught
}

class ForeignAppError extends Error {
  readonly code: ErrorCode
  readonly httpStatus: number
  readonly fields?: Record<string, unknown>
  readonly requestId?: string

  constructor(
    code: ErrorCode,
    message: string,
    opts: { httpStatus?: number; fields?: Record<string, unknown>; requestId?: string } = {},
  ) {
    super(message)
    this.name = "AppError"
    this.code = code
    this.httpStatus = opts.httpStatus ?? 500
    if (opts.fields !== undefined) this.fields = opts.fields
    if (opts.requestId !== undefined) this.requestId = opts.requestId
  }
}

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

describe("toAppError", () => {
  it("returns a real AppError untouched", () => {
    const err = new AppError(ErrorCode.RATE_LIMITED, "Slow down")
    expect(toAppError(err)).toBe(err)
  })

  it("normalizes a foreign AppError instance to its real code, not INTERNAL", () => {
    const foreign = new ForeignAppError(ErrorCode.RATE_LIMITED, "Slow down", {
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
      httpStatus: 422,
      fields: { title: "Too short", count: 3, nested: { a: 1 }, blank: null },
    })

    expect(foreign).not.toBeInstanceOf(AppError)
    expect(toAppError(foreign).fields).toEqual({ title: "Too short" })
  })

  it("normalizes a plain wire-shaped envelope", () => {
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

  it("omits fields entirely when none of them are strings", () => {
    const normalized = toAppError({
      code: ErrorCode.VALIDATION,
      message: "Check your input",
      fields: { count: 3 },
    })
    expect(normalized.fields).toBeUndefined()
  })

  it("ignores a non-object fields value", () => {
    const normalized = toAppError({
      code: ErrorCode.VALIDATION,
      message: "Check your input",
      fields: ["title"],
    })
    expect(normalized.fields).toBeUndefined()
  })

  it("falls through to INTERNAL for a Node errno-style error", () => {
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

  it("wraps a thrown non-Error value as INTERNAL", () => {
    expect(toAppError("boom").code).toBe(ErrorCode.INTERNAL)
    expect(toAppError("boom").message).toBe("Unknown error")
  })

  it("falls back to a usable message when the envelope carries an empty one", () => {
    expect(toAppError({ code: ErrorCode.INTERNAL, message: "" }).message).toBe("Unknown error")
  })
})

describe("toAppError over what the real typed client throws", () => {
  it("exercises the structural branch: the client's throw is NOT an instance of the app's AppError", async () => {
    const caught = await catchFrom(
      clientRespondingWith(429, { code: ErrorCode.RATE_LIMITED, message: "nope" }),
    )

    expect(toAppError(caught).code).toBe(ErrorCode.RATE_LIMITED)
  })

  it.each([
    [429, ErrorCode.RATE_LIMITED],
    [409, ErrorCode.CONFLICT],
    [422, ErrorCode.VALIDATION],
    [403, ErrorCode.FORBIDDEN],
  ])("recovers the %i envelope's code instead of collapsing to INTERNAL", async (status, code) => {
    const caught = await catchFrom(
      clientRespondingWith(status, { code, message: "nope", requestId: "req-7" }),
    )
    const normalized = toAppError(caught)

    expect(normalized).toBeInstanceOf(AppError)
    expect(normalized.code).toBe(code)
    expect(normalized.httpStatus).toBe(status)
    expect(normalized.requestId).toBe("req-7")
  })

  it("recovers validation fields from a real client throw", async () => {
    const caught = await catchFrom(
      clientRespondingWith(422, {
        code: ErrorCode.VALIDATION,
        message: "bad",
        fields: { title: "Too short" },
      }),
    )

    expect(toAppError(caught).fields).toEqual({ title: "Too short" })
  })
})
