import type { MediaKind } from "@civfix/shared"

import { toAppError } from "@/lib/api"

/**
 * Byte-prep helpers for the report media pipeline.
 *
 * The pipeline itself (presign -> PUT -> finalize) lives in the SHARED report wizard (@civfix/ui); the
 * web side only supplies these two primitives through the camera capability (lib/web-camera.ts): the
 * client-side SHA-256 (Web Crypto SubtleCrypto, no dependency) and the File -> MediaKind mapping.
 */

/** Compute the lowercase hex SHA-256 of a file's bytes using SubtleCrypto. */
export async function sha256Hex(file: Blob): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw toAppError(new Error("Secure context required to hash the photo (crypto.subtle unavailable)."))
  }
  const buffer = await file.arrayBuffer()
  const digest = await subtle.digest("SHA-256", buffer)
  const bytes = new Uint8Array(digest)
  let hex = ""
  for (const b of bytes) hex += b.toString(16).padStart(2, "0")
  return hex
}

/** Map a File's MIME type to the shared MediaKind enum (image | video). */
export function mediaKindFromFile(file: File): MediaKind {
  return file.type.startsWith("video/") ? "video" : "image"
}
