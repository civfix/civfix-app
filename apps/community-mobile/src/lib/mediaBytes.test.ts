import { test } from "node:test"
import assert from "node:assert/strict"
import {
  contentTypeFromExtension,
  isJpeg,
  resolveUploadContentType,
  sniffMediaContentType,
  stripJpegMetadata,
} from "./mediaBytes.ts"

function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2
  return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload]
}

function bytesOf(text: string): number[] {
  return [...text].map((c) => c.charCodeAt(0))
}

const EXIF_GPS_PAYLOAD = bytesOf("Exif\0\0MM*GPSLatitude 37.7749 GPSLongitude -122.4194")
const JFIF_PAYLOAD = bytesOf("JFIF\0")
const ICC_PAYLOAD = bytesOf("ICC_PROFILE\0")
const SCAN_DATA = [0x11, 0x22, 0x33, 0x44, 0x55]

function jpegWith(segments: number[][]): Uint8Array<ArrayBuffer> {
  return new Uint8Array([
    0xff,
    0xd8,
    ...segments.flat(),
    ...segment(0xda, [0x00, 0x01]),
    ...SCAN_DATA,
    0xff,
    0xd9,
  ])
}

test("stripJpegMetadata removes the Exif segment carrying GPS", () => {
  const withGps = jpegWith([segment(0xe0, JFIF_PAYLOAD), segment(0xe1, EXIF_GPS_PAYLOAD)])
  const stripped = stripJpegMetadata(withGps)

  assert.ok(isJpeg(stripped))
  assert.equal(containsMarker(withGps, 0xe1), true)
  assert.equal(containsMarker(stripped, 0xe1), false)
  assert.equal(containsAscii(withGps, "GPSLatitude"), true)
  assert.equal(containsAscii(stripped, "GPSLatitude"), false)
  assert.ok(stripped.length < withGps.length)
})

test("stripJpegMetadata keeps JFIF, ICC and Adobe segments and the entropy-coded scan", () => {
  const source = jpegWith([
    segment(0xe0, JFIF_PAYLOAD),
    segment(0xe1, EXIF_GPS_PAYLOAD),
    segment(0xe2, ICC_PAYLOAD),
    segment(0xee, bytesOf("Adobe")),
    segment(0xed, bytesOf("Photoshop 3.0 IPTC")),
    segment(0xfe, bytesOf("a comment")),
  ])
  const stripped = stripJpegMetadata(source)

  assert.equal(containsAscii(stripped, "JFIF"), true)
  assert.equal(containsAscii(stripped, "ICC_PROFILE"), true)
  assert.equal(containsAscii(stripped, "Adobe"), true)
  assert.equal(containsAscii(stripped, "Photoshop 3.0 IPTC"), false)
  assert.equal(containsAscii(stripped, "a comment"), false)
  assert.deepEqual([...stripped.slice(-7)], [...SCAN_DATA, 0xff, 0xd9])
})

test("stripJpegMetadata still strips when legal 0xFF fill bytes pad the markers", () => {
  const padded = new Uint8Array([
    0xff,
    0xd8,
    ...segment(0xe0, JFIF_PAYLOAD),
    0xff,
    0xff,
    0xff,
    ...segment(0xe1, EXIF_GPS_PAYLOAD),
    ...segment(0xda, [0x00, 0x01]),
    ...SCAN_DATA,
    0xff,
    0xd9,
  ])
  const stripped = stripJpegMetadata(padded)

  assert.equal(containsAscii(padded, "GPSLatitude"), true)
  assert.equal(containsAscii(stripped, "GPSLatitude"), false)
  assert.equal(containsAscii(stripped, "JFIF"), true)
  assert.deepEqual([...stripped.slice(-7)], [...SCAN_DATA, 0xff, 0xd9])
})

test("stripJpegMetadata is a no-op for bytes with nothing to strip", () => {
  const clean = jpegWith([segment(0xe0, JFIF_PAYLOAD)])
  assert.equal(stripJpegMetadata(clean), clean)
})

test("stripJpegMetadata refuses to touch non-jpeg or desynced bytes", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
  assert.equal(stripJpegMetadata(png), png)

  const desynced = new Uint8Array([0xff, 0xd8, 0x00, 0x01, 0x02, 0x03, 0xff, 0xd9])
  assert.equal(stripJpegMetadata(desynced), desynced)

  const truncated = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x01])
  assert.equal(stripJpegMetadata(truncated), truncated)
})

test("sniffMediaContentType reads the real container from the leading bytes", () => {
  assert.equal(sniffMediaContentType(jpegWith([segment(0xe0, JFIF_PAYLOAD)])), "image/jpeg")
  assert.equal(
    sniffMediaContentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/png",
  )
  assert.equal(
    sniffMediaContentType(new Uint8Array([...bytesOf("RIFF"), 0, 0, 0, 0, ...bytesOf("WEBPVP8 ")])),
    "image/webp",
  )
  assert.equal(
    sniffMediaContentType(new Uint8Array([0, 0, 0, 0x14, ...bytesOf("ftypqt  ")])),
    "video/quicktime",
  )
  assert.equal(
    sniffMediaContentType(new Uint8Array([0, 0, 0, 0x18, ...bytesOf("ftypmp42")])),
    "video/mp4",
  )
  assert.equal(
    sniffMediaContentType(new Uint8Array([0, 0, 0, 0x18, ...bytesOf("ftypheic")])),
    "image/heic",
  )
  assert.equal(sniffMediaContentType(new Uint8Array([1, 2, 3])), null)
})

test("contentTypeFromExtension maps the file extension, ignoring a query string", () => {
  assert.equal(contentTypeFromExtension("file:///tmp/a.JPG"), "image/jpeg")
  assert.equal(contentTypeFromExtension("file:///tmp/a.heic"), "image/heic")
  assert.equal(contentTypeFromExtension("file:///tmp/a.mov?x=1"), "video/quicktime")
  assert.equal(contentTypeFromExtension("file:///tmp/a.mp4"), "video/mp4")
  assert.equal(contentTypeFromExtension("file:///tmp/a"), null)
})

test("resolveUploadContentType prefers the bytes, then the extension, then the declared mime", () => {
  const mov = new Uint8Array([0, 0, 0, 0x14, ...bytesOf("ftypqt  ")])
  assert.equal(resolveUploadContentType("video", mov, "file:///tmp/out.mp4", "video/mp4"), "video/quicktime")

  const unknown = new Uint8Array([1, 2, 3, 4])
  assert.equal(resolveUploadContentType("video", unknown, "file:///tmp/out.mov", "video/mp4"), "video/quicktime")
  assert.equal(resolveUploadContentType("image", unknown, "file:///tmp/out", "image/png"), "image/png")
})

test("resolveUploadContentType never returns a type the presign allowlist rejects", () => {
  const heic = new Uint8Array([0, 0, 0, 0x18, ...bytesOf("ftypheic")])
  assert.equal(resolveUploadContentType("image", heic, "file:///tmp/a.heic", "image/heic"), "image/jpeg")

  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  assert.equal(resolveUploadContentType("video", png, "file:///tmp/a.png", "image/png"), "video/mp4")
})

function containsMarker(bytes: Uint8Array, marker: number): boolean {
  for (let i = 0; i + 1 < bytes.length; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === marker) return true
  }
  return false
}

function containsAscii(bytes: Uint8Array, text: string): boolean {
  const needle = bytesOf(text)
  outer: for (let i = 0; i + needle.length <= bytes.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer
    }
    return true
  }
  return false
}
