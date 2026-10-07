import { Directory, File, Paths } from "expo-file-system"
import * as Crypto from "expo-crypto"
import * as ImagePicker from "expo-image-picker"
import { ImageManipulator, SaveFormat } from "expo-image-manipulator"
import { Image as ImageCompressor, Video as VideoCompressor } from "react-native-compressor"
import { AppError, ErrorCode } from "@civfix/shared"
import { motion } from "@civfix/ui/theme"
import type {
  CameraCapability,
  CapturedMedia,
  PreparedUpload,
} from "@civfix/ui/capabilities"
import { MAX_VIDEO_SECONDS } from "./cameraSession"
import { resolveUploadContentType, stripJpegMetadata } from "./mediaBytes"
import { capturedMediaFromPickerAsset, fileUri } from "./capturedMedia"

type Navigator = (captureId: string) => void
let navigateToSurface: Navigator | null = null
let pendingCapture: { id: string; resolve: (media: CapturedMedia | null) => void } | null = null
let captureSequence = 0

export function setCameraNavigator(nav: Navigator | null): void {
  navigateToSurface = nav
}

export function resolveCameraCapture(media: CapturedMedia | null, captureId?: string): void {
  const pending = pendingCapture
  if (!pending || pending.id !== captureId) return
  pendingCapture = null
  pending.resolve(media)
  sweepStaleMediaTempFiles()
}

const IMAGE_MAX_DIMENSION = 1920
const IMAGE_QUALITY = 0.8

const VIDEO_MIN_COMPRESS_MB = 0

const STALE_TEMP_AGE_MS = 60 * 60_000
const SWEEP_DELETE_LIMIT = 40
const SWEEP_SCAN_LIMIT = 400
const SWEEP_DELAY_MS = motion.pagePop.duration

const TEMP_OUTPUT_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|mp4|mov|m4a)$/i

let sweptThisSession = false

function localPath(uri: string): string {
  const withoutScheme = uri.replace(/^file:\/*/i, "/")
  try {
    return decodeURI(withoutScheme)
  } catch {
    return withoutScheme
  }
}

function isTempOutputName(uri: string): boolean {
  const name = localPath(uri).split("/").pop() ?? ""
  return TEMP_OUTPUT_NAME.test(name)
}

function deleteTempFile(uri: string): void {
  try {
    const file = new File(fileUri(uri))
    if (file.exists) file.delete()
  } catch {
    // Best-effort cleanup: a temp file that survives is removed by the next session's stale sweep.
  }
}

function sweepDirectory(directory: Directory, now: number, budget: number): number {
  let removed = 0
  if (budget <= 0) return removed
  if (!directory.exists) return removed
  const entries = directory.list().slice(0, SWEEP_SCAN_LIMIT)
  for (const entry of entries) {
    if (removed >= budget) break
    if (!(entry instanceof File)) continue
    if (!TEMP_OUTPUT_NAME.test(entry.name)) continue
    try {
      const modified = entry.modificationTime
      if (modified === null || now - modified < STALE_TEMP_AGE_MS) continue
      entry.delete()
      removed += 1
    } catch {
      // A file the OS reclaimed or still holds open is skipped; the next session retries it.
    }
  }
  return removed
}

function sweepStaleMediaTempFiles(): void {
  if (sweptThisSession) return
  sweptThisSession = true
  setTimeout(() => {
    const now = Date.now()
    let removed = 0
    try {
      removed = sweepDirectory(new Directory(Paths.cache, "ImageManipulator"), now, SWEEP_DELETE_LIMIT)
    } catch {
      // The sweep is housekeeping; an unreadable directory must never fail the capture that triggered it.
    }
    setTimeout(() => {
      try {
        sweepDirectory(Paths.cache, now, SWEEP_DELETE_LIMIT - removed)
      } catch {
        // Housekeeping only: an unreadable cache dir must never fail the capture that triggered it.
      }
    }, 0)
  }, SWEEP_DELAY_MS)
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes)
  const view = new Uint8Array(digest)
  let out = ""
  for (let i = 0; i < view.length; i++) out += view[i]!.toString(16).padStart(2, "0")
  return out
}

async function compressMedia(media: CapturedMedia): Promise<string> {
  if (media.kind === "video") {
    return VideoCompressor.compress(media.uri, {
      compressionMethod: "auto",
      minimumFileSizeForCompress: VIDEO_MIN_COMPRESS_MB,
    })
  }
  return ImageCompressor.compress(media.uri, {
    compressionMethod: "auto",
    maxWidth: IMAGE_MAX_DIMENSION,
    maxHeight: IMAGE_MAX_DIMENSION,
    quality: IMAGE_QUALITY,
    output: "jpg",
    returnableOutputType: "uri",
  })
}

async function reencodeImageWithoutMetadata(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(fileUri(uri))
  let image: Awaited<ReturnType<typeof context.renderAsync>> | null = null
  try {
    image = await context.renderAsync()
    if (Math.max(image.width, image.height) > IMAGE_MAX_DIMENSION) {
      context.resize(
        image.width >= image.height
          ? { width: IMAGE_MAX_DIMENSION }
          : { height: IMAGE_MAX_DIMENSION },
      )
      const resized = await context.renderAsync()
      image.release()
      image = resized
    }
    const saved = await image.saveAsync({ compress: IMAGE_QUALITY, format: SaveFormat.JPEG })
    return saved.uri
  } finally {
    image?.release()
    context.release()
  }
}

export const nativeCamera: CameraCapability = {
  isAvailable(): boolean {
    return navigateToSurface !== null
  },

  capture(_opts?: { mode?: "photo" | "video"; orientation?: "portrait" | "device" }): Promise<CapturedMedia | null> {
    if (!navigateToSurface) return Promise.resolve(null)
    pendingCapture?.resolve(null)
    pendingCapture = null
    captureSequence += 1
    const id = `capture-${captureSequence}`
    return new Promise<CapturedMedia | null>((resolve) => {
      pendingCapture = { id, resolve }
      navigateToSurface?.(id)
    })
  },

  async pickFromLibrary(): Promise<CapturedMedia | null> {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 1,
      videoMaxDuration: MAX_VIDEO_SECONDS,
    })
    sweepStaleMediaTempFiles()
    if (result.canceled || result.assets.length === 0) return null
    return capturedMediaFromPickerAsset(result.assets[0]!)
  },

  async prepareUpload(media: CapturedMedia): Promise<PreparedUpload> {
    const sourcePath = localPath(media.uri)
    const temporaries: string[] = []
    const track = (uri: string) => {
      if (localPath(uri) === sourcePath) return
      if (!isTempOutputName(uri)) return
      if (!temporaries.includes(uri)) temporaries.push(uri)
    }

    try {
      let uploadUri: string
      try {
        const compressedUri = await compressMedia(media)
        track(compressedUri)
        uploadUri = media.kind === "image" ? await reencodeImageWithoutMetadata(compressedUri) : compressedUri
        track(uploadUri)
      } catch (err) {
        throw new AppError(ErrorCode.MEDIA_REJECTED, "Could not process the captured media.", { cause: err })
      }

      let putBytes: Uint8Array<ArrayBuffer>
      let sha256: string
      try {
        const file = new File(fileUri(uploadUri))
        const raw = await file.bytes()
        if (raw.byteLength <= 0) {
          throw new AppError(ErrorCode.MEDIA_REJECTED, "The captured media is empty.")
        }
        const scrubbed = media.kind === "image" ? stripJpegMetadata(raw) : raw
        putBytes = new Uint8Array(scrubbed.byteLength)
        putBytes.set(scrubbed)
        sha256 = await sha256Hex(putBytes)
      } catch (err) {
        if (err instanceof AppError) throw err
        throw new AppError(ErrorCode.MEDIA_REJECTED, "Could not read the captured media.", { cause: err })
      }

      return {
        contentType: resolveUploadContentType(media.kind, putBytes, uploadUri, media.mime),
        byteSize: putBytes.byteLength,
        sha256,
        body: putBytes.buffer,
      }
    } finally {
      for (const uri of temporaries) deleteTempFile(uri)
    }
  },
}
