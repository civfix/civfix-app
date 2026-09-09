import { AppError, ErrorCode } from "@civfix/shared"
import type { ApiClient } from "@civfix/shared/client"
import type { CameraCapability, CapturedMedia } from "../capabilities"

export const UPLOAD_PUT_BASE_TIMEOUT_MS = 120_000
export const UPLOAD_MIN_BYTES_PER_SEC = 64_000

export type UploadPhase = "preparing" | "uploading" | "finalizing" | "done"

export interface UploadProgress {
  phase: UploadPhase
  loaded: number
  total: number
  fraction: number
}

export interface UploadMediaInput {
  api: ApiClient
  camera: CameraCapability
  media: CapturedMedia
  onProgress?: (progress: UploadProgress) => void
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

export interface UploadedMedia {
  uploadId: string
  mediaId: string
  byteSize: number
  contentType: string
  sha256: string
}

export function uploadPutTimeoutMs(byteSize: number): number {
  return Math.max(UPLOAD_PUT_BASE_TIMEOUT_MS, (byteSize / UPLOAD_MIN_BYTES_PER_SEC) * 1000)
}

function progress(phase: UploadPhase, loaded: number, total: number): UploadProgress {
  const safeTotal = total > 0 ? total : 0
  const clamped = safeTotal > 0 ? Math.min(Math.max(loaded, 0), safeTotal) : 0
  return {
    phase,
    loaded: clamped,
    total: safeTotal,
    fraction: safeTotal > 0 ? clamped / safeTotal : phase === "done" ? 1 : 0,
  }
}

type XhrLike = {
  open(method: string, url: string): void
  setRequestHeader(name: string, value: string): void
  send(body: unknown): void
  abort(): void
  status: number
  timeout: number
  upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } | null
  onload: (() => void) | null
  onerror: (() => void) | null
  ontimeout: (() => void) | null
  onabort: (() => void) | null
}

function xhrCtor(): (new () => XhrLike) | null {
  const g = globalThis as { XMLHttpRequest?: new () => XhrLike }
  return typeof g.XMLHttpRequest === "function" ? g.XMLHttpRequest : null
}

function uploadFailed(status: number): AppError {
  return new AppError(ErrorCode.INTERNAL, `Upload failed (${status}). Please try again.`)
}

function uploadUnreachable(cause: unknown): AppError {
  return new AppError(
    ErrorCode.INTERNAL,
    "Upload failed. Please check your connection and try again.",
    { cause },
  )
}

export async function putUpload(
  url: string,
  headers: Record<string, string>,
  body: BodyInit,
  byteSize: number,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<void> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal) {
    if (signal.aborted) abort()
    else signal.addEventListener("abort", abort, { once: true })
  }
  const timer = setTimeout(abort, uploadPutTimeoutMs(byteSize))
  let res: Response
  try {
    res = await fetchImpl(url, { method: "PUT", headers, body, signal: controller.signal })
  } catch (err) {
    throw uploadUnreachable(err)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", abort)
  }
  if (!res.ok) throw uploadFailed(res.status)
}

function putUploadWithProgress(
  Xhr: new () => XhrLike,
  url: string,
  headers: Record<string, string>,
  body: BodyInit,
  byteSize: number,
  onProgress: (progress: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new Xhr()
    let settled = false
    const settle = (run: () => void) => {
      if (settled) return
      settled = true
      signal?.removeEventListener("abort", onAbortSignal)
      run()
    }
    const onAbortSignal = () => {
      try {
        xhr.abort()
      } catch {
        settle(() => reject(uploadUnreachable(new Error("Upload aborted."))))
      }
    }
    xhr.open("PUT", url)
    xhr.timeout = uploadPutTimeoutMs(byteSize)
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)
    if (xhr.upload) {
      xhr.upload.onprogress = (event) => {
        onProgress(progress("uploading", event.loaded, event.lengthComputable ? event.total : byteSize))
      }
    }
    xhr.onload = () =>
      settle(() => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(uploadFailed(xhr.status))
      })
    xhr.onerror = () => settle(() => reject(uploadUnreachable(new Error("Network error."))))
    xhr.ontimeout = () => settle(() => reject(uploadUnreachable(new Error("Upload timed out."))))
    xhr.onabort = () => settle(() => reject(uploadUnreachable(new Error("Upload aborted."))))
    if (signal) {
      if (signal.aborted) {
        onAbortSignal()
        return
      }
      signal.addEventListener("abort", onAbortSignal, { once: true })
    }
    xhr.send(body)
  })
}

export async function uploadMedia(input: UploadMediaInput): Promise<UploadedMedia> {
  const { api, camera, media, onProgress, fetchImpl, signal } = input
  onProgress?.(progress("preparing", 0, 0))

  let prepared
  try {
    prepared = await camera.prepareUpload(media)
  } catch (err) {
    if (err instanceof AppError) throw err
    throw new AppError(ErrorCode.MEDIA_REJECTED, "Could not process that file.", { cause: err })
  }
  if (prepared.byteSize <= 0) {
    throw new AppError(ErrorCode.MEDIA_REJECTED, "That file is empty.")
  }

  const presign = await api.createMediaUpload({
    kind: media.kind,
    contentType: prepared.contentType,
    byteSize: prepared.byteSize,
    sha256: prepared.sha256,
  })

  onProgress?.(progress("uploading", 0, prepared.byteSize))
  const Xhr = onProgress ? xhrCtor() : null
  if (Xhr) {
    await putUploadWithProgress(
      Xhr,
      presign.putUrl,
      presign.headers,
      prepared.body as BodyInit,
      prepared.byteSize,
      onProgress as (p: UploadProgress) => void,
      signal,
    )
  } else {
    await putUpload(
      presign.putUrl,
      presign.headers,
      prepared.body as BodyInit,
      prepared.byteSize,
      fetchImpl ?? fetch,
      signal,
    )
  }

  onProgress?.(progress("finalizing", prepared.byteSize, prepared.byteSize))
  const finalized = await api.finalizeMedia({ uploadId: presign.uploadId })
  onProgress?.(progress("done", prepared.byteSize, prepared.byteSize))

  return {
    uploadId: presign.uploadId,
    mediaId: finalized.mediaId,
    byteSize: prepared.byteSize,
    contentType: prepared.contentType,
    sha256: prepared.sha256,
  }
}

export async function uploadMediaId(input: UploadMediaInput): Promise<string> {
  return (await uploadMedia(input)).uploadId
}
