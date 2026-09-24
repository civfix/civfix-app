"use client"

import type { ApiClient } from "@civfix/shared/client"
import { uploadMedia } from "@civfix/ui/data"
import type { UploadProgress } from "@civfix/ui/data"
import type { CapturedMedia } from "@civfix/ui/capabilities"

import { webCamera } from "@/lib/web-camera"

export interface ConsoleUploadResult {
  uploadId: string
  mediaId: string
  previewUrl: string
}

export interface ConsoleUploadInput {
  api: ApiClient
  media: CapturedMedia
  onProgress?: (progress: UploadProgress) => void
  signal?: AbortSignal
}

export async function uploadConsoleImage(
  input: ConsoleUploadInput,
): Promise<ConsoleUploadResult> {
  const uploaded = await uploadMedia({
    api: input.api,
    camera: webCamera,
    media: input.media,
    ...(input.onProgress ? { onProgress: input.onProgress } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
  })
  return {
    uploadId: uploaded.uploadId,
    mediaId: uploaded.mediaId,
    previewUrl: input.media.uri,
  }
}

export async function pickConsoleImage(): Promise<CapturedMedia | null> {
  return webCamera.pickFromLibrary()
}

export async function acceptDroppedImage(file: unknown): Promise<CapturedMedia | null> {
  return webCamera.acceptFile?.(file) ?? null
}
