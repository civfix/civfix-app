import { describe, it, expect } from "vitest"

import { readExifGps } from "@/lib/exif"

/**
 * Build a JPEG buffer: SOI, an APP1 EXIF segment wrapping the given TIFF block, then EOI. The APP1
 * size field covers the "Exif\0\0" id (6 bytes) + the TIFF block + the 2 size bytes themselves.
 */
function jpegWithTiff(tiff: Uint8Array): Uint8Array {
  const exifId = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00] // "Exif\0\0"
  const app1Payload = exifId.length + tiff.length
  const app1Size = app1Payload + 2 // size field includes its own 2 bytes
  const bytes: number[] = []
  bytes.push(0xff, 0xd8) // SOI
  bytes.push(0xff, 0xe1) // APP1 marker
  bytes.push((app1Size >> 8) & 0xff, app1Size & 0xff) // big-endian segment size
  bytes.push(...exifId)
  bytes.push(...tiff)
  bytes.push(0xff, 0xd9) // EOI
  return new Uint8Array(bytes)
}

/** A little-endian TIFF: header -> IFD0 (GPSInfo pointer) -> GPS IFD (lat/lng refs + DMS rationals). */
function tiffWithGps(opts: {
  lat: [number, number, number]
  lng: [number, number, number]
  latRef: string
  lngRef: string
}): Uint8Array {
  // Layout (offsets are from the TIFF start):
  //   0..7    TIFF header (II, 0x002A, ifd0Offset=8)
  //   8..     IFD0: 1 entry (GPSInfo pointer 0x8825 -> gpsIfdOffset)
  //   gpsIfd  GPS IFD: 4 entries (latRef, lat, lngRef, lng) + next-IFD(0)
  //   data    the two rational triples (6 rationals * 8 bytes)
  const le = (n: number, bytes: number) => {
    const out: number[] = []
    for (let i = 0; i < bytes; i++) out.push((n >> (8 * i)) & 0xff)
    return out
  }

  const header = [0x49, 0x49, ...le(0x002a, 2), ...le(8, 4)] // "II", magic, IFD0 @ 8

  // IFD0: count=1, one 12-byte entry, next=0.
  // Entry: tag=0x8825 (GPSInfo), type=4 (LONG), count=1, value=gpsIfdOffset.
  const ifd0Start = 8
  const ifd0Len = 2 + 12 + 4
  const gpsIfdOffset = ifd0Start + ifd0Len

  // GPS IFD: count=4, four 12-byte entries, next=0.
  const gpsIfdLen = 2 + 12 * 4 + 4
  const dataOffset = gpsIfdOffset + gpsIfdLen

  // Each rational triple is 3 * (num,den) = 24 bytes. latData at dataOffset, lngData after it.
  const latDataOffset = dataOffset
  const lngDataOffset = dataOffset + 24

  const rational = (value: number) => [...le(Math.round(value), 4), ...le(1, 4)] // num/den with den=1

  const entry = (tag: number, type: number, count: number, valueBytes: number[]) => {
    const v = [...valueBytes]
    while (v.length < 4) v.push(0)
    return [...le(tag, 2), ...le(type, 2), ...le(count, 4), ...v.slice(0, 4)]
  }

  const asciiRef = (s: string) => [s.charCodeAt(0), 0, 0, 0] // 2-char ASCII (letter + NUL) inline

  const ifd0 = [...le(1, 2), ...entry(0x8825, 4, 1, le(gpsIfdOffset, 4)), ...le(0, 4)]

  const gpsIfd = [
    ...le(4, 2),
    ...entry(0x0001, 2, 2, asciiRef(opts.latRef)), // GPSLatitudeRef
    ...entry(0x0002, 5, 3, le(latDataOffset, 4)), // GPSLatitude (3 rationals @ pointer)
    ...entry(0x0003, 2, 2, asciiRef(opts.lngRef)), // GPSLongitudeRef
    ...entry(0x0004, 5, 3, le(lngDataOffset, 4)), // GPSLongitude
    ...le(0, 4),
  ]

  const data = [
    ...rational(opts.lat[0]),
    ...rational(opts.lat[1]),
    ...rational(opts.lat[2]),
    ...rational(opts.lng[0]),
    ...rational(opts.lng[1]),
    ...rational(opts.lng[2]),
  ]

  return new Uint8Array([...header, ...ifd0, ...gpsIfd, ...data])
}

function fileOf(bytes: Uint8Array): File {
  // Cast to BlobPart: TS 5.7's typed arrays are generic over the buffer kind and BlobPart rejects the
  // possibly-shared ArrayBufferLike. These buffers are always plain ArrayBuffers at runtime.
  return new File([bytes as BlobPart], "photo.jpg", { type: "image/jpeg" })
}

describe("readExifGps - happy path", () => {
  it("parses N/E coordinates from a synthesized JPEG", async () => {
    // 34 deg 3' 7" N, 118 deg 14' 37" W (roughly downtown LA, but W so the sign flips).
    const tiff = tiffWithGps({
      lat: [34, 3, 7],
      lng: [118, 14, 37],
      latRef: "N",
      lngRef: "W",
    })
    const gps = await readExifGps(fileOf(jpegWithTiff(tiff)))
    expect(gps).not.toBeNull()
    // 34 + 3/60 + 7/3600 = 34.05194...
    expect(gps?.lat).toBeCloseTo(34.0519, 3)
    // West -> negative.
    expect(gps?.lng).toBeCloseTo(-(118 + 14 / 60 + 37 / 3600), 3)
    expect(gps?.lng).toBeLessThan(0)
  })

  it("applies S/W reference signs", async () => {
    const tiff = tiffWithGps({ lat: [10, 0, 0], lng: [20, 0, 0], latRef: "S", lngRef: "W" })
    const gps = await readExifGps(fileOf(jpegWithTiff(tiff)))
    expect(gps?.lat).toBeCloseTo(-10, 6)
    expect(gps?.lng).toBeCloseTo(-20, 6)
  })
})

describe("readExifGps - malformed / absent -> null", () => {
  it("returns null for a non-JPEG (bad SOI)", async () => {
    const notJpeg = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05])
    expect(await readExifGps(fileOf(notJpeg))).toBeNull()
  })

  it("returns null for a JPEG with no EXIF (SOI + EOI only)", async () => {
    const bare = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    expect(await readExifGps(fileOf(bare))).toBeNull()
  })

  it("returns null when the TIFF byte-order marker is invalid", async () => {
    const badTiff = new Uint8Array([0x00, 0x00, 0x00, 0x2a, 0, 0, 0, 8])
    expect(await readExifGps(fileOf(jpegWithTiff(badTiff)))).toBeNull()
  })

  it("returns null when the TIFF magic (0x002A) is wrong", async () => {
    const badMagic = new Uint8Array([0x49, 0x49, 0xff, 0xff, 8, 0, 0, 0])
    expect(await readExifGps(fileOf(jpegWithTiff(badMagic)))).toBeNull()
  })

  it("returns null when IFD0 has no GPSInfo pointer", async () => {
    // Valid header + an IFD0 with a single unrelated tag and no 0x8825 pointer.
    const header = [0x49, 0x49, 0x2a, 0x00, 8, 0, 0, 0]
    const ifd0 = [
      1, 0, // count = 1
      0x00, 0x01, 2, 0, 1, 0, 0, 0, 65, 0, 0, 0, // tag 0x0100, type ASCII, count 1, "A"
      0, 0, 0, 0, // next IFD = 0
    ]
    expect(await readExifGps(fileOf(jpegWithTiff(new Uint8Array([...header, ...ifd0]))))).toBeNull()
  })

  it("returns null for the null-island (0,0) sentinel", async () => {
    const tiff = tiffWithGps({ lat: [0, 0, 0], lng: [0, 0, 0], latRef: "N", lngRef: "E" })
    expect(await readExifGps(fileOf(jpegWithTiff(tiff)))).toBeNull()
  })

  it("returns null for out-of-range coordinates", async () => {
    // 200 degrees latitude is impossible -> rejected by the range guard.
    const tiff = tiffWithGps({ lat: [200, 0, 0], lng: [20, 0, 0], latRef: "N", lngRef: "E" })
    expect(await readExifGps(fileOf(jpegWithTiff(tiff)))).toBeNull()
  })

  it("returns null for an empty file", async () => {
    expect(await readExifGps(fileOf(new Uint8Array([])))).toBeNull()
  })
})

describe("readExifGps - offset hardening (P2-6, must not throw)", () => {
    const le = (n: number, bytes: number) => {
    const out: number[] = []
    for (let i = 0; i < bytes; i++) out.push((n >> (8 * i)) & 0xff)
    return out
  }

  it("returns null when the GPSInfo pointer points far past the buffer", async () => {
    // Valid header + IFD0 whose GPSInfo pointer (0x8825) is a huge offset well beyond the slice.
    const header = [0x49, 0x49, ...le(0x002a, 2), ...le(8, 4)]
    const ifd0 = [
      ...le(1, 2), // count = 1
      ...le(0x8825, 2),
      ...le(4, 2), // type LONG
      ...le(1, 4), // count 1
      ...le(0x7fffffff, 4), // GPS IFD pointer way out of range
      ...le(0, 4), // next IFD
    ]
    const tiff = new Uint8Array([...header, ...ifd0])
    // Must degrade to null rather than throwing past the buffer end.
    await expect(readExifGps(fileOf(jpegWithTiff(tiff)))).resolves.toBeNull()
  })

  it("returns null when an IFD claims a huge entry count (no OOB read / hang)", async () => {
    // Header + IFD0 claiming 65535 entries but with no real entry bytes following.
    const header = [0x49, 0x49, ...le(0x002a, 2), ...le(8, 4)]
    const ifd0 = [...le(0xffff, 2)] // count = 65535, then the buffer simply ends
    const tiff = new Uint8Array([...header, ...ifd0])
    await expect(readExifGps(fileOf(jpegWithTiff(tiff)))).resolves.toBeNull()
  })

  it("returns null when the GPS IFD pointer lands mid-buffer but its entries run off the end", async () => {
    const header = [0x49, 0x49, ...le(0x002a, 2), ...le(8, 4)]
    const ifd0Start = 8
    const ifd0Len = 2 + 12 + 4
    const gpsIfdOffset = ifd0Start + ifd0Len
    const ifd0 = [
      ...le(1, 2),
      ...le(0x8825, 2),
      ...le(4, 2),
      ...le(1, 4),
      ...le(gpsIfdOffset, 4),
      ...le(0, 4),
    ]
    // GPS IFD claims 4 entries but we only supply the 2-byte count, so every entry read is OOB.
    const gpsIfd = [...le(4, 2)]
    const tiff = new Uint8Array([...header, ...ifd0, ...gpsIfd])
    await expect(readExifGps(fileOf(jpegWithTiff(tiff)))).resolves.toBeNull()
  })
})
