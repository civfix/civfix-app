/**
 * A purpose-built parser instead of a third-party EXIF library: only the GPS IFD is needed, and this
 * keeps the static export lean. Path: JPEG APP1 ("Exif\0\0") -> TIFF header (byte order) -> IFD0's
 * GPSInfo pointer (tag 0x8825) -> GPS IFD. Anything unexpected returns null so callers fall back to a
 * manual pin.
 */

export interface ExifGps {
  lat: number
  lng: number
}

// TIFF tag ids in the GPS IFD.
const TAG_GPS_LAT_REF = 0x0001
const TAG_GPS_LAT = 0x0002
const TAG_GPS_LNG_REF = 0x0003
const TAG_GPS_LNG = 0x0004
// IFD0 tag that points to the GPS IFD.
const TAG_GPS_IFD_POINTER = 0x8825

// A real GPS/IFD0 directory has a handful of entries; cap the count we will iterate so a crafted file
// claiming up to 65535 entries cannot make us walk ~780KB of arbitrary bytes (hardening, not a crash
// fix: DataView already throws OOB and the whole reader is wrapped in try/catch).
const MAX_IFD_ENTRIES = 256

/** True when [offset, offset+length) lies fully inside the buffer (so a read will not go OOB). */
function inBounds(view: DataView, offset: number, length: number): boolean {
  return offset >= 0 && length >= 0 && offset + length <= view.byteLength
}

/** Read three RATIONAL pairs (deg, min, sec) and combine to signed decimal degrees. */
function dmsToDecimal(parts: [number, number, number], ref: string): number {
  const [deg, min, sec] = parts
  let value = deg + min / 60 + sec / 3600
  if (ref === "S" || ref === "W") value = -value
  return value
}

/**
 * Parse a single IFD entry's value. Supports only the types we read: ASCII (2) for the ref letter and
 * RATIONAL (5) for the coordinate triples. Returns undefined for unsupported shapes.
 */
function readEntryValue(
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  little: boolean,
): { tag: number; ascii?: string; rationals?: number[] } | undefined {
  // The 12-byte entry itself must be fully in range before any field is read.
  if (!inBounds(view, entryOffset, 12)) return undefined
  const tag = view.getUint16(entryOffset, little)
  const type = view.getUint16(entryOffset + 2, little)
  const count = view.getUint32(entryOffset + 4, little)
  const valueOffsetField = entryOffset + 8

  if (type === 2) {
    // ASCII: inline when <= 4 bytes, otherwise at the pointer. We only need the first letter.
    const inline = count <= 4
    const dataOffset = inline ? valueOffsetField : tiffStart + view.getUint32(valueOffsetField, little)
    let s = ""
    for (let i = 0; i < count; i++) {
      if (!inBounds(view, dataOffset + i, 1)) break
      const c = view.getUint8(dataOffset + i)
      if (c === 0) break
      s += String.fromCharCode(c)
    }
    return { tag, ascii: s }
  }

  if (type === 5) {
    // RATIONAL: 8 bytes each (num/den), always at the pointer for count >= 1 coordinate triples.
    const dataOffset = tiffStart + view.getUint32(valueOffsetField, little)
    const rationals: number[] = []
    for (let i = 0; i < count; i++) {
      const at = dataOffset + i * 8
      if (!inBounds(view, at, 8)) break
      const num = view.getUint32(at, little)
      const den = view.getUint32(at + 4, little)
      rationals.push(den === 0 ? 0 : num / den)
    }
    return { tag, rationals }
  }

  return { tag }
}

/** Walk every entry of the IFD at `ifdOffset`, returning a tag -> parsed-value map. */
function readIfd(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  little: boolean,
): Map<number, { ascii?: string; rationals?: number[] }> {
  const out = new Map<number, { ascii?: string; rationals?: number[] }>()
  // The 2-byte entry count must be readable; an out-of-range IFD pointer yields no entries.
  if (!inBounds(view, ifdOffset, 2)) return out
  const entryCount = Math.min(view.getUint16(ifdOffset, little), MAX_IFD_ENTRIES)
  let entry = ifdOffset + 2
  for (let i = 0; i < entryCount; i++) {
    const parsed = readEntryValue(view, tiffStart, entry, little)
    if (parsed) out.set(parsed.tag, { ascii: parsed.ascii, rationals: parsed.rationals })
    entry += 12
  }
  return out
}

/** Parse the GPS coordinates out of the TIFF block that begins at `tiffStart`. */
function parseTiffForGps(view: DataView, tiffStart: number): ExifGps | null {
  // The 8-byte TIFF header (byte-order + magic + IFD0 offset) must be fully in range.
  if (!inBounds(view, tiffStart, 8)) return null
  // Byte order: "II" (0x4949) little-endian, "MM" (0x4D4D) big-endian.
  const byteOrder = view.getUint16(tiffStart, false)
  const little = byteOrder === 0x4949
  if (!little && byteOrder !== 0x4d4d) return null

  // 0x002A magic confirms a TIFF header.
  if (view.getUint16(tiffStart + 2, little) !== 0x002a) return null

  const ifd0Offset = tiffStart + view.getUint32(tiffStart + 4, little)

  // IFD0 holds only the GPSInfo pointer (a LONG) we care about; read it directly rather than decoding
  // every IFD0 entry. Absent pointer -> no GPS block.
  const gpsPointer = findLongValue(view, tiffStart, ifd0Offset, TAG_GPS_IFD_POINTER, little)
  if (gpsPointer === undefined) return null

  const gps = readIfd(view, tiffStart, tiffStart + gpsPointer, little)

  const latParts = gps.get(TAG_GPS_LAT)?.rationals
  const lngParts = gps.get(TAG_GPS_LNG)?.rationals
  const latRef = gps.get(TAG_GPS_LAT_REF)?.ascii ?? "N"
  const lngRef = gps.get(TAG_GPS_LNG_REF)?.ascii ?? "E"

  if (!latParts || latParts.length < 3 || !lngParts || lngParts.length < 3) return null

  const lat = dmsToDecimal([latParts[0] ?? 0, latParts[1] ?? 0, latParts[2] ?? 0], latRef)
  const lng = dmsToDecimal([lngParts[0] ?? 0, lngParts[1] ?? 0, lngParts[2] ?? 0], lngRef)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  if (lat === 0 && lng === 0) return null // null-island sentinel; treat as absent

  return { lat, lng }
}

/** Re-read a LONG-typed IFD entry value (used for the GPS IFD pointer). */
function findLongValue(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  wantTag: number,
  little: boolean,
): number | undefined {
  if (!inBounds(view, ifdOffset, 2)) return undefined
  const entryCount = Math.min(view.getUint16(ifdOffset, little), MAX_IFD_ENTRIES)
  let entry = ifdOffset + 2
  for (let i = 0; i < entryCount; i++) {
    if (!inBounds(view, entry, 12)) return undefined
    const tag = view.getUint16(entry, little)
    if (tag === wantTag) return view.getUint32(entry + 8, little)
    entry += 12
  }
  return undefined
}

/**
 * Read GPS coordinates from a JPEG file. Returns null for non-JPEGs, JPEGs without GPS EXIF, or any
 * parse error. Never throws.
 */
export async function readExifGps(file: File): Promise<ExifGps | null> {
  try {
    // EXIF (if present) lives in the first segments; 256 KB is far more than enough headroom.
    const slice = file.slice(0, 256 * 1024)
    const buffer = await slice.arrayBuffer()
    const view = new DataView(buffer)

    // JPEG SOI marker.
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return null

    let offset = 2
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset, false)
      // All segment markers are 0xFFxx; bail if we lose alignment.
      if ((marker & 0xff00) !== 0xff00) return null
      const size = view.getUint16(offset + 2, false)
      if (size < 2) return null

      // APP1 (0xFFE1) carries EXIF. Confirm the "Exif\0\0" identifier.
      if (marker === 0xffe1) {
        const idOffset = offset + 4
        const isExif =
          view.getUint8(idOffset) === 0x45 && // E
          view.getUint8(idOffset + 1) === 0x78 && // x
          view.getUint8(idOffset + 2) === 0x69 && // i
          view.getUint8(idOffset + 3) === 0x66 && // f
          view.getUint8(idOffset + 4) === 0x00 &&
          view.getUint8(idOffset + 5) === 0x00
        if (isExif) {
          const tiffStart = idOffset + 6
          return parseTiffForGps(view, tiffStart)
        }
      }

      // SOS (0xFFDA) marks the start of compressed data; no metadata past here.
      if (marker === 0xffda) return null

      offset += 2 + size
    }
    return null
  } catch {
    return null
  }
}
