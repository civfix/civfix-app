import type { MediaKind } from "@civfix/shared"

import { toAppError } from "@/lib/api"

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

export function mediaKindFromFile(file: File): MediaKind {
  return file.type.startsWith("video/") ? "video" : "image"
}
