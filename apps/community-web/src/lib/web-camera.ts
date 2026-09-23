"use client"

/**
 * Web CAMERA capability impl (UI-unification Stage 4 slice 7) - the platform-seam realization of
 * `@civfix/ui/capabilities` CameraCapability for the browser. It replaces the old web report wizard's
 * Step-2 file input + EXIF seeding (features/report/step-details.tsx) and the media pipeline byte prep
 * (lib/media.ts), folded behind the shared seam so the unified ReportFlowBody drives capture/pick/prepare
 * without importing anything web-only.
 *
 *   - capture({ mode })  : opens a hidden `<input type="file" accept="image/*" capture="environment">`
 *                          (the mobile-browser rear camera; degrades to a file chooser on desktop), reads
 *                          the photo's EXIF GPS (lib/exif), and returns a CapturedMedia with that location
 *                          (geomSource "exif") when present.
 *   - pickFromLibrary()  : the same input WITHOUT `capture`, so the OS file/photo picker opens.
 *   - acceptFile(item)   : `pickFromLibrary` MINUS the picker - the wizard's drag-and-drop target already
 *                          holds the File, so it runs the identical conversion (object-URL, EXIF, registry)
 *                          and a dropped photo is indistinguishable from a chosen one downstream.
 *   - prepareUpload()    : reads the original File's bytes, computes the SHA-256 via SubtleCrypto
 *                          (lib/media.sha256Hex), and hands back the File as the PUT body (the shared
 *                          pipeline does presign -> PUT -> finalize). EXIF/orientation handling stays here
 *                          (the bytes are uploaded as-is; the server strips/normalizes), matching the
 *                          original web flow which uploaded the raw File.
 *
 * The shared CapturedMedia carries a STRING `uri` (an object-URL for the preview), but `prepareUpload`
 * needs the original File. We keep a small uri -> File registry here so the seam can recover the bytes;
 * entries are pruned when an object-URL is revoked via `releaseCaptured`.
 */
import type {
  CameraCapability,
  CapturedMedia,
  PreparedUpload,
} from "@civfix/ui/capabilities"

import { readExifGps } from "@/lib/exif"
import { sha256Hex, mediaKindFromFile } from "@/lib/media"

/** object-URL -> the File it was created from, so prepareUpload can read the original bytes. */
const fileByUri = new Map<string, File>()

// Engines without the file-input `cancel` event (Safari < 16.4, Chrome < 113) signal a dismissed picker
// only by focus returning to the window, and there is no feature test for that event (`oncancel` exists
// on every element because of <dialog>). So the focus fallback is always armed, with a grace long enough
// that a `change` landing after the focus (a camera handing back a large photo) still wins.
export const PICKER_FOCUS_CANCEL_GRACE_MS = 3000

/**
 * Open a one-shot file input and resolve with the chosen File (or null if cancelled). `useCapture` adds
 * the `capture` attribute so a mobile browser opens the rear camera directly; without it the OS picker
 * (library) opens. Accepts images and videos so a short clip can be attached too.
 */
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

/** Build a CapturedMedia from a chosen File: an object-URL preview + the EXIF GPS location when present. */
async function toCapturedMedia(file: File): Promise<CapturedMedia> {
  const uri = URL.createObjectURL(file)
  fileByUri.set(uri, file)
  const kind = mediaKindFromFile(file)
  const media: CapturedMedia = {
    uri,
    kind,
    mime: file.type || (kind === "video" ? "video/mp4" : "image/jpeg"),
  }
  // EXIF GPS (images only): seed the report pin as "exif". Best-effort; never throws.
  if (kind === "image") {
    const gps = await readExifGps(file)
    if (gps) media.location = { lat: gps.lat, lng: gps.lng, source: "exif" }
  }
  return media
}

/** The web CameraCapability singleton (built once; the registry persists for the app lifetime). */
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

  // The optional drag-and-drop seam. `unknown` in, because the shared contract cannot name a DOM type;
  // anything that is not a real File resolves to null rather than throwing, so a stray drag (a URL, a text
  // selection) is simply ignored by the wizard.
  async acceptFile(item: unknown): Promise<CapturedMedia | null> {
    if (typeof File === "undefined" || !(item instanceof File)) return null
    return toCapturedMedia(item)
  },

  async prepareUpload(media: CapturedMedia): Promise<PreparedUpload> {
    // Recover the original File for these bytes; fall back to fetching the object-URL as a Blob if the
    // registry was pruned (e.g. after an HMR reload).
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

/** Revoke a captured object-URL and drop its registry entry (call when discarding a capture). */
export function releaseCaptured(uri: string): void {
  if (fileByUri.has(uri)) {
    try {
      URL.revokeObjectURL(uri)
    } catch {
      // ignore
    }
    fileByUri.delete(uri)
  }
}
