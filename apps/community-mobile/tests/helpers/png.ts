import { inflateSync } from "node:zlib"

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const CHANNELS = 4

export type DecodedPng = {
  width: number
  height: number
  pixels: Buffer
}

export type Rgba = {
  r: number
  g: number
  b: number
  a: number
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function unfilter(raw: Buffer, width: number, height: number): Buffer {
  const stride = width * CHANNELS
  const out = Buffer.alloc(stride * height)
  let offset = 0
  for (let row = 0; row < height; row += 1) {
    const filter = raw[offset]
    offset += 1
    const line = raw.subarray(offset, offset + stride)
    offset += stride
    const target = row * stride
    const above = target - stride
    for (let index = 0; index < stride; index += 1) {
      const left = index >= CHANNELS ? out[target + index - CHANNELS] : 0
      const up = row > 0 ? out[above + index] : 0
      const upLeft = row > 0 && index >= CHANNELS ? out[above + index - CHANNELS] : 0
      const value = line[index]
      let restored: number
      if (filter === 0) restored = value
      else if (filter === 1) restored = value + left
      else if (filter === 2) restored = value + up
      else if (filter === 3) restored = value + ((left + up) >> 1)
      else if (filter === 4) restored = value + paeth(left, up, upLeft)
      else throw new Error(`unsupported PNG filter type ${filter} on row ${row}`)
      out[target + index] = restored & 0xff
    }
  }
  return out
}

export function decodeRgbaPng(bytes: Buffer): DecodedPng {
  if (!bytes.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG file")
  let width = 0
  let height = 0
  const idat: Buffer[] = []
  let sawIhdr = false
  let cursor = 8
  while (cursor < bytes.length) {
    const length = bytes.readUInt32BE(cursor)
    const type = bytes.toString("ascii", cursor + 4, cursor + 8)
    const body = bytes.subarray(cursor + 8, cursor + 8 + length)
    cursor += 12 + length
    if (type === "IHDR") {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      const bitDepth = body[8]
      const colourType = body[9]
      const compression = body[10]
      const filterMethod = body[11]
      const interlace = body[12]
      if (colourType !== 6) throw new Error(`expected RGBA colour type 6, got ${colourType}`)
      if (bitDepth !== 8) throw new Error(`expected bit depth 8, got ${bitDepth}`)
      if (compression !== 0) throw new Error(`unsupported compression method ${compression}`)
      if (filterMethod !== 0) throw new Error(`unsupported filter method ${filterMethod}`)
      if (interlace !== 0) throw new Error("interlaced PNGs are not supported")
      sawIhdr = true
    } else if (type === "IDAT") {
      idat.push(Buffer.from(body))
    } else if (type === "IEND") {
      break
    }
  }
  if (!sawIhdr) throw new Error("PNG has no IHDR chunk")
  if (idat.length === 0) throw new Error("PNG has no IDAT data")
  const raw = inflateSync(Buffer.concat(idat))
  const expected = height * (width * CHANNELS + 1)
  if (raw.length !== expected) {
    throw new Error(`inflated ${raw.length} bytes, expected ${expected}`)
  }
  return { width, height, pixels: unfilter(raw, width, height) }
}

export function pixelAt(png: DecodedPng, x: number, y: number): Rgba {
  const clampedX = Math.min(Math.max(x, 0), png.width - 1)
  const clampedY = Math.min(Math.max(y, 0), png.height - 1)
  const offset = (clampedY * png.width + clampedX) * CHANNELS
  return {
    r: png.pixels[offset],
    g: png.pixels[offset + 1],
    b: png.pixels[offset + 2],
    a: png.pixels[offset + 3],
  }
}

export function transparentShare(png: DecodedPng, step = 8): number {
  let sampled = 0
  let transparent = 0
  for (let y = 0; y < png.height; y += step) {
    for (let x = 0; x < png.width; x += step) {
      sampled += 1
      if (png.pixels[(y * png.width + x) * CHANNELS + 3] === 0) transparent += 1
    }
  }
  return transparent / sampled
}

export type PngHeader = {
  width: number
  height: number
  bitDepth: number
  colourType: number
  interlace: number
}

export function readPngHeader(bytes: Buffer): PngHeader {
  if (!bytes.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG file")
  if (bytes.toString("ascii", 12, 16) !== "IHDR") throw new Error("PNG does not open with IHDR")
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colourType: bytes[25],
    interlace: bytes[28],
  }
}
