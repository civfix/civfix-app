import { describe, expect, it, vi } from "vitest"
import { AppError } from "@civfix/shared"
import type { ApiClient } from "@civfix/shared/client"
import type { CameraCapability, CapturedMedia, PreparedUpload } from "../../capabilities"
import {
  UPLOAD_MIN_BYTES_PER_SEC,
  UPLOAD_PUT_BASE_TIMEOUT_MS,
  uploadMedia,
  uploadPutTimeoutMs,
} from "../uploadMedia"

const MEDIA: CapturedMedia = { uri: "file://x.jpg", kind: "image", mime: "image/jpeg" }

function camera(prepared: Partial<PreparedUpload> = {}): CameraCapability {
  return {
    isAvailable: () => true,
    capture: async () => null,
    pickFromLibrary: async () => null,
    prepareUpload: async () => ({
      contentType: "image/jpeg",
      byteSize: 1024,
      sha256: "a".repeat(64),
      body: new ArrayBuffer(8),
      ...prepared,
    }),
  }
}

function api(): { client: ApiClient; calls: string[] } {
  const calls: string[] = []
  const client = {
    createMediaUpload: async () => {
      calls.push("presign")
      return { uploadId: "up-1", putUrl: "https://storage/put", headers: { "x-amz": "1" } }
    },
    finalizeMedia: async () => {
      calls.push("finalize")
      return { mediaId: "m-1", status: "validating" as const }
    },
  } as unknown as ApiClient
  return { client, calls }
}

const okFetch = () => vi.fn(async () => new Response(null, { status: 200 })) as unknown as typeof fetch

describe("uploadMedia", () => {
  it("runs prepare -> presign -> PUT -> finalize and returns both ids the finalize answered with", async () => {
    const { client, calls } = api()
    const doFetch = okFetch()
    const result = await uploadMedia({ api: client, camera: camera(), media: MEDIA, fetchImpl: doFetch })
    expect(result).toEqual({
      uploadId: "up-1",
      mediaId: "m-1",
      byteSize: 1024,
      contentType: "image/jpeg",
      sha256: "a".repeat(64),
    })
    expect(calls).toEqual(["presign", "finalize"])
    expect(doFetch).toHaveBeenCalledOnce()
  })

  it("PUTs the prepared bytes with the presigned headers", async () => {
    const { client } = api()
    const doFetch = okFetch()
    await uploadMedia({ api: client, camera: camera(), media: MEDIA, fetchImpl: doFetch })
    const [url, init] = (doFetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!
    expect(url).toBe("https://storage/put")
    expect(init.method).toBe("PUT")
    expect(init.headers).toEqual({ "x-amz": "1" })
  })

  it("REFUSES an empty file before it ever reaches the presign endpoint", async () => {
    const { client, calls } = api()
    const err = await uploadMedia({
      api: client,
      camera: camera({ byteSize: 0 }),
      media: MEDIA,
      fetchImpl: okFetch(),
    }).catch((e) => e)
    expect(err).toBeInstanceOf(AppError)
    expect((err as AppError).code).toBe("MEDIA_REJECTED")
    expect(calls).toEqual([])
  })

  it("wraps a byte-prep failure as MEDIA_REJECTED rather than leaking the platform error", async () => {
    const { client } = api()
    const broken: CameraCapability = {
      ...camera(),
      prepareUpload: async () => {
        throw new Error("codec exploded")
      },
    }
    const err = await uploadMedia({ api: client, camera: broken, media: MEDIA, fetchImpl: okFetch() }).catch(
      (e) => e,
    )
    expect((err as AppError).code).toBe("MEDIA_REJECTED")
  })

  it("does NOT finalize when the PUT is refused", async () => {
    const { client, calls } = api()
    const doFetch = vi.fn(async () => new Response(null, { status: 403 })) as unknown as typeof fetch
    const err = await uploadMedia({ api: client, camera: camera(), media: MEDIA, fetchImpl: doFetch }).catch(
      (e) => e,
    )
    expect((err as AppError).message).toContain("403")
    expect(calls).toEqual(["presign"])
  })

  it("reports progress through every phase, ending at a full fraction", async () => {
    const { client } = api()
    const phases: string[] = []
    let last = 0
    await uploadMedia({
      api: client,
      camera: camera(),
      media: MEDIA,
      fetchImpl: okFetch(),
      onProgress: (p) => {
        phases.push(p.phase)
        last = p.fraction
      },
    })
    expect(phases[0]).toBe("preparing")
    expect(phases).toContain("uploading")
    expect(phases).toContain("finalizing")
    expect(phases.at(-1)).toBe("done")
    expect(last).toBe(1)
  })
})

describe("the web progress path (XMLHttpRequest)", () => {
  class FakeXhr {
    static last: FakeXhr | null = null
    status = 200
    timeout = 0
    sent: unknown = null
    upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = {
      onprogress: null,
    }
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    ontimeout: (() => void) | null = null
    onabort: (() => void) | null = null
    headers: Record<string, string> = {}
    url = ""
    constructor() {
      FakeXhr.last = this
    }
    open(_method: string, url: string) {
      this.url = url
    }
    setRequestHeader(name: string, value: string) {
      this.headers[name] = value
    }
    abort() {
      this.onabort?.()
    }
    send(body: unknown) {
      this.sent = body
      this.upload.onprogress?.({ lengthComputable: true, loaded: 512, total: 1024 })
      this.onload?.()
    }
  }

  it("uploads through XHR so the web host gets real byte progress", async () => {
    const g = globalThis as { XMLHttpRequest?: unknown }
    const before = g.XMLHttpRequest
    g.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest
    try {
      const { client, calls } = api()
      const fractions: number[] = []
      const result = await uploadMedia({
        api: client,
        camera: camera(),
        media: MEDIA,
        onProgress: (p) => {
          if (p.phase === "uploading") fractions.push(p.fraction)
        },
      })
      expect(result.uploadId).toBe("up-1")
      expect(calls).toEqual(["presign", "finalize"])
      expect(fractions).toContain(0.5)
      expect(FakeXhr.last?.url).toBe("https://storage/put")
      expect(FakeXhr.last?.headers).toEqual({ "x-amz": "1" })
      expect(FakeXhr.last?.timeout).toBe(UPLOAD_PUT_BASE_TIMEOUT_MS)
    } finally {
      if (before === undefined) delete g.XMLHttpRequest
      else g.XMLHttpRequest = before
    }
  })

  it("rejects - and never finalizes - when the XHR PUT is refused", async () => {
    class RefusingXhr extends FakeXhr {
      override send() {
        this.status = 403
        this.onload?.()
      }
    }
    const g = globalThis as { XMLHttpRequest?: unknown }
    const before = g.XMLHttpRequest
    g.XMLHttpRequest = RefusingXhr as unknown as typeof XMLHttpRequest
    try {
      const { client, calls } = api()
      const err = await uploadMedia({
        api: client,
        camera: camera(),
        media: MEDIA,
        onProgress: () => {},
      }).catch((e) => e)
      expect((err as AppError).message).toContain("403")
      expect(calls).toEqual(["presign"])
    } finally {
      if (before === undefined) delete g.XMLHttpRequest
      else g.XMLHttpRequest = before
    }
  })
})

describe("uploadPutTimeoutMs", () => {
  it("floors at the base timeout for a small file", () => {
    expect(uploadPutTimeoutMs(1000)).toBe(UPLOAD_PUT_BASE_TIMEOUT_MS)
  })

  it("scales with size so a large video on a slow uplink is not cut off mid-flight", () => {
    const big = UPLOAD_MIN_BYTES_PER_SEC * 600
    expect(uploadPutTimeoutMs(big)).toBe(600_000)
    expect(uploadPutTimeoutMs(big)).toBeGreaterThan(UPLOAD_PUT_BASE_TIMEOUT_MS)
  })
})
