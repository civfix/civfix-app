export const ALLOWED_IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export const ALLOWED_VIDEO_CONTENT_TYPES = ["video/mp4", "video/quicktime"] as const

const JPEG_SOI = [0xff, 0xd8] as const
const PRESERVED_APP_MARKERS = new Set([0xe0, 0xe2, 0xee])

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false
  }
  return true
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.length < offset + length) return ""
  let out = ""
  for (let i = 0; i < length; i++) out += String.fromCharCode(bytes[offset + i]!)
  return out
}

export function isJpeg(bytes: Uint8Array): boolean {
  return startsWith(bytes, JPEG_SOI)
}

function isStrippableMarker(marker: number): boolean {
  if (marker === 0xfe) return true
  if (marker < 0xe0 || marker > 0xef) return false
  return !PRESERVED_APP_MARKERS.has(marker)
}

export function stripJpegMetadata(bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  if (!isJpeg(bytes)) return bytes
  const keep: [number, number][] = []
  let keepFrom = 0
  let offset = 2
  let stripped = false

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return bytes
    while (bytes[offset + 1] === 0xff) offset += 1
    if (offset + 4 > bytes.length) return bytes
    const marker = bytes[offset + 1]!
    if (marker === 0xd9) break
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset += 2
      continue
    }
    const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!
    if (length < 2) return bytes
    const end = offset + 2 + length
    if (end > bytes.length) return bytes
    if (marker === 0xda) break
    if (isStrippableMarker(marker)) {
      keep.push([keepFrom, offset])
      keepFrom = end
      stripped = true
    }
    offset = end
  }

  if (!stripped) return bytes
  keep.push([keepFrom, bytes.length])
  let size = 0
  for (const [from, to] of keep) size += to - from
  const out = new Uint8Array(size)
  let written = 0
  for (const [from, to] of keep) {
    out.set(bytes.subarray(from, to), written)
    written += to - from
  }
  return out
}

export function sniffMediaContentType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg"
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png"
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp"
  if (ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4)
    if (brand === "qt  ") return "video/quicktime"
    if (brand.startsWith("hei") || brand.startsWith("mif") || brand.startsWith("msf")) return "image/heic"
    return "video/mp4"
  }
  return null
}

export function contentTypeFromExtension(uri: string): string | null {
  const path = uri.split(/[?#]/)[0] ?? ""
  const extension = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase()
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "png":
      return "image/png"
    case "webp":
      return "image/webp"
    case "heic":
    case "heif":
      return "image/heic"
    case "mov":
    case "qt":
      return "video/quicktime"
    case "mp4":
    case "m4v":
      return "video/mp4"
    default:
      return null
  }
}

export function resolveUploadContentType(
  kind: "image" | "video",
  bytes: Uint8Array,
  uri: string,
  mime?: string | undefined,
): string {
  const allowed: readonly string[] =
    kind === "video" ? ALLOWED_VIDEO_CONTENT_TYPES : ALLOWED_IMAGE_CONTENT_TYPES
  const candidates = [sniffMediaContentType(bytes), contentTypeFromExtension(uri), mime]
  for (const candidate of candidates) {
    if (candidate && allowed.includes(candidate)) return candidate
  }
  return kind === "video" ? "video/mp4" : "image/jpeg"
}
