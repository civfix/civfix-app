"use client"

/**
 * The shared CapturedMedia carries a string `uri` (an object-URL for the preview), but `prepareUpload`
 * needs the original File, so a small uri -> File registry recovers the bytes; `releaseCaptured` prunes
 * it. The bytes upload as-is because the server strips metadata and normalizes orientation.
 */
import type {
  CameraCapability,
  CapturedMedia,
  PreparedUpload,
} from "@civfix/ui/capabilities"

import { readExifGps } from "@/lib/exif"
import { sha256Hex, mediaKindFromFile } from "@/lib/media"

const fileByUri = new Map<string, File>()

// Engines without the file-input `cancel` event (Safari < 16.4, Chrome < 113) signal a dismissed picker
// only by focus returning to the window, and there is no feature test for that event (`oncancel` exists
// on every element because of <dialog>). So the focus fallback is always armed, with a grace long enough
// that a `change` landing after the focus (a camera handing back a large photo) still wins.
export const PICKER_FOCUS_CANCEL_GRACE_MS = 3000

function pickFile(useCapture: boolean): Promise<File | null> {
  if (typeof document === "undefined") return Promise.resolve(null)
  return new Promise<File | null>((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*,video/*"
    if (useCapture) input.setAttribute("capture", "environment")
    input.style.position = "fixed"
    input.style.left = "-9999px"
    let settled = false
    let graceTimer: ReturnType<typeof setTimeout> | null = null
    const onWindowFocus = () => {
      graceTimer = setTimeout(() => {
        if (!input.files?.length) finish(null)
      }, PICKER_FOCUS_CANCEL_GRACE_MS)
    }
    const finish = (file: File | null) => {
      if (settled) return
      settled = true
      if (graceTimer !== null) clearTimeout(graceTimer)
      window.removeEventListener("focus", onWindowFocus)
      input.remove()
      resolve(file)
    }
    input.addEventListener("change", () => finish(input.files?.[0] ?? null))
    input.addEventListener("cancel", () => finish(null))
    window.addEventListener("focus", onWindowFocus, { once: true })
    document.body.appendChild(input)
    input.click()
  })
}

async function toCapturedMedia(file: File): Promise<CapturedMedia> {
  const uri = URL.createObjectURL(file)
  fileByUri.set(uri, file)
  const kind = mediaKindFromFile(file)
  const media: CapturedMedia = {
    uri,
    kind,
    mime: file.type || (kind === "video" ? "video/mp4" : "image/jpeg"),
  }
  if (kind === "image") {
    const gps = await readExifGps(file)
    if (gps) media.location = { lat: gps.lat, lng: gps.lng, source: "exif" }
  }
  return media
}

export const webCamera: CameraCapability = {
  isAvailable(): boolean {
    return typeof document !== "undefined"
  },

  async capture(_opts?: { mode?: "photo" | "video" }): Promise<CapturedMedia | null> {
    const file = await pickFile(true)
    return file ? toCapturedMedia(file) : null
  },

  async pickFromLibrary(): Promise<CapturedMedia | null> {
    const file = await pickFile(false)
    return file ? toCapturedMedia(file) : null
  },

  // `unknown` because the shared contract cannot name a DOM type; a stray drag (a URL, a text selection)
  // resolves to null so the wizard ignores it.
  async acceptFile(item: unknown): Promise<CapturedMedia | null> {
    if (typeof File === "undefined" || !(item instanceof File)) return null
    return toCapturedMedia(item)
  },

  async prepareUpload(media: CapturedMedia): Promise<PreparedUpload> {
    // The registry can be empty after an HMR reload, so fall back to fetching the object-URL.
    let blob: Blob | null = fileByUri.get(media.uri) ?? null
    if (!blob) {
      const res = await fetch(media.uri)
      blob = await res.blob()
    }
    const contentType =
      blob.type || media.mime || (media.kind === "video" ? "video/mp4" : "image/jpeg")
    const sha256 = await sha256Hex(blob)
    return {
      contentType,
      byteSize: blob.size,
      sha256,
      body: blob,
    }
  },
}

export function releaseCaptured(uri: string): void {
  if (fileByUri.has(uri)) {
    try {
      URL.revokeObjectURL(uri)
    } catch {
      // Best-effort: the registry entry is dropped whether or not revocation succeeds.
    }
    fileByUri.delete(uri)
  }
}
