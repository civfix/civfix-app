import { describe, it, expect } from "vitest"
import { AppError, ErrorCode, toAppError } from "@civfix/shared"
import { createApiClient } from "@civfix/shared/client"


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
