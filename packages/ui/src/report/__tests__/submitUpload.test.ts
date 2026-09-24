import { afterEach, describe, expect, it, vi } from "vitest"
import { AppError, ErrorCode } from "@civfix/shared"
import { putUpload, UPLOAD_PUT_BASE_TIMEOUT_MS, UPLOAD_MIN_BYTES_PER_SEC } from "../../data/uploadMedia"

function okFetch(status = 200): typeof fetch {
  return (async () => ({ ok: status >= 200 && status < 300, status }) as Response) as unknown as typeof fetch
}

function statusFetch(status: number): typeof fetch {
  return (async () => ({ ok: false, status }) as Response) as unknown as typeof fetch
}

function rejectingFetch(err: unknown): typeof fetch {
  return (async () => {
    throw err
  }) as unknown as typeof fetch
}

function neverSettlesFetch(): typeof fetch {
  return ((_url: string, init?: { signal?: AbortSignal }) =>
    new Promise((_resolve, reject) => {
      const signal = init?.signal
      if (signal) signal.addEventListener("abort", () => reject(new Error("aborted")))
    })) as unknown as typeof fetch
}

describe("putUpload", () => {
  afterEach(() => vi.useRealTimers())

  it("(a) resolves when the PUT is ok", async () => {
    await expect(putUpload("https://x", {}, "body" as BodyInit, 1000, okFetch())).resolves.toBeUndefined()
  })

  it("(b) throws AppError INTERNAL with the status in the message on a non-ok response", async () => {
    const err = await putUpload("https://x", {}, "body" as BodyInit, 1000, statusFetch(403)).catch((e) => e)
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe(ErrorCode.INTERNAL)
    expect(err.message).toContain("403")
  })

  it("(c) wraps a rejecting fetch in AppError INTERNAL, preserving the cause", async () => {
    const cause = new Error("network down")
    const err = await putUpload("https://x", {}, "body" as BodyInit, 1000, rejectingFetch(cause)).catch(
      (e) => e,
    )
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe(ErrorCode.INTERNAL)
    expect(err.cause).toBe(cause)
  })

  it("(d) aborts and rejects with AppError when the PUT never settles past the timeout", async () => {
    vi.useFakeTimers()
    const promise = putUpload("https://x", {}, "body" as BodyInit, 1000, neverSettlesFetch())
    const assertion = promise.catch((e) => e)
    await vi.advanceTimersByTimeAsync(UPLOAD_PUT_BASE_TIMEOUT_MS + 1)
    const err = await assertion
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe(ErrorCode.INTERNAL)
  })

  it("(e) scales the deadline to the payload size, holding the base timeout as a floor", async () => {
    vi.useFakeTimers()
    const bigByteSize = 50 * 1024 * 1024
    const computedDeadline = (bigByteSize / UPLOAD_MIN_BYTES_PER_SEC) * 1000
    expect(computedDeadline).toBeGreaterThan(UPLOAD_PUT_BASE_TIMEOUT_MS)

    const big = putUpload("https://x", {}, "body" as BodyInit, bigByteSize, neverSettlesFetch())
    const bigAssertion = big.catch((e) => e)
    await vi.advanceTimersByTimeAsync(UPLOAD_PUT_BASE_TIMEOUT_MS + 1)
    expect(await Promise.race([bigAssertion, Promise.resolve("pending")])).toBe("pending")
    await vi.advanceTimersByTimeAsync(computedDeadline - UPLOAD_PUT_BASE_TIMEOUT_MS)
    const bigErr = await bigAssertion
    expect(bigErr).toBeInstanceOf(AppError)
    expect(bigErr.code).toBe(ErrorCode.INTERNAL)

    const small = putUpload("https://x", {}, "body" as BodyInit, 1000, neverSettlesFetch())
    const smallAssertion = small.catch((e) => e)
    await vi.advanceTimersByTimeAsync(UPLOAD_PUT_BASE_TIMEOUT_MS - 1)
    expect(await Promise.race([smallAssertion, Promise.resolve("pending")])).toBe("pending")
    await vi.advanceTimersByTimeAsync(2)
    const smallErr = await smallAssertion
    expect(smallErr).toBeInstanceOf(AppError)
    expect(smallErr.code).toBe(ErrorCode.INTERNAL)
  })
})
