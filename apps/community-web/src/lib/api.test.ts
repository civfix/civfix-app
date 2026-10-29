import { describe, it, expect, afterEach, vi } from "vitest"
import { AppError, ErrorCode, toAppError } from "@civfix/contract"
import { createApiClient } from "@civfix/contract/client"


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
    () => null,
    (err: unknown) => err,
  )
  expect(caught).toBeInstanceOf(Error)
  expect(caught).toBeInstanceOf(AppError)
  return caught
}

describe("toAppError over what the real typed client throws", () => {
  it("the client's throw is the app's own AppError (one module instance across entries)", async () => {
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

describe("the web api client's headers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("T17: names the web client and sends no app version", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            minAppVersion: { ios: null, android: null },
            storeUrl: { ios: null, android: "https://play.google.com/store/apps/details?id=org.civfix.community" },
            announcement: null,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    )
    vi.stubGlobal("fetch", fetchMock)
    vi.resetModules()
    const { api } = await import("@/lib/api")

    await api.getAppConfig()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const headers = new Headers(fetchMock.mock.calls[0]![1]?.headers)
    expect(headers.get("x-client")).toBe("web")
    expect([...headers.keys()].some((name) => name.toLowerCase() === "x-civfix-app-version")).toBe(false)
  })
})
