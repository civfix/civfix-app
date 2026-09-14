#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { deflateSync, inflateSync } from "node:zlib"

if (!process.features.typescript) {
  const rerun = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      ...process.execArgv,
      ...process.argv.slice(1),
    ],
    { stdio: "inherit" },
  )
  process.exit(rerun.status ?? 1)
}

const here = dirname(fileURLToPath(import.meta.url))
const appDir = join(here, "..")
const outDir = join(appDir, "assets", "onboarding")

const mapStyle = await import("../../../packages/ui/src/map/mapStyle.ts")
const scenes = await import("../src/components/onboarding/onboardingMapScenes.ts")

const {
  BASEMAP_TILES,
  DARK_RASTER_BRIGHTNESS_MIN,
  DEFAULT_ATTRIBUTION,
  basemapPaper,
  withCartoKey,
} = mapStyle
const {
  ONBOARDING_MAP_SCALES,
  ONBOARDING_MAP_SCENES,
  ONBOARDING_MAP_SCHEMES,
  ONBOARDING_MAP_STAGES,
  REPORT_PIN_SPOT,
  TOGETHER_EVENT_SPOT,
  TRACK_CLUSTER_SPOT,
  TRACK_PIN_SPOTS,
  fractionInScene,
  mapArtFileName,
} = scenes

const TILE_RATIO = "@2x"
const TILE_PX = 512
const [STILL_SCALE] = ONBOARDING_MAP_SCALES
const MAX_PALETTE = 256
const FETCH_CONCURRENCY = 4
const USER_AGENT = "civfix-onboarding-map-art (build-time still generator)"
const appConfig = createRequire(import.meta.url)("../app.config.js")({ config: {} })
const CARTO_KEY = appConfig.extra?.cartoApiKey

const previewFlag = process.argv.indexOf("--preview")
const previewDir = previewFlag > -1 ? process.argv[previewFlag + 1] : null

const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function readChunks(bytes) {
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) throw new Error("not a PNG")
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunks = []
  let cursor = 8
  while (cursor < bytes.length) {
    const length = view.getUint32(cursor)
    const type = String.fromCharCode(...bytes.subarray(cursor + 4, cursor + 8))
    chunks.push({ type, data: bytes.subarray(cursor + 8, cursor + 8 + length) })
    cursor += 12 + length
    if (type === "IEND") break
  }
  return chunks
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

function unfilter(raw, height, stride, bpp) {
  const out = new Uint8Array(stride * height)
  let offset = 0
  for (let row = 0; row < height; row += 1) {
    const filter = raw[offset]
    offset += 1
    const target = row * stride
    const above = target - stride
    for (let i = 0; i < stride; i += 1) {
      const value = raw[offset + i]
      const left = i >= bpp ? out[target + i - bpp] : 0
      const up = row > 0 ? out[above + i] : 0
      const upLeft = row > 0 && i >= bpp ? out[above + i - bpp] : 0
      let restored
      if (filter === 0) restored = value
      else if (filter === 1) restored = value + left
      else if (filter === 2) restored = value + up
      else if (filter === 3) restored = value + ((left + up) >> 1)
      else if (filter === 4) restored = value + paeth(left, up, upLeft)
      else throw new Error(`unsupported PNG filter ${filter}`)
      out[target + i] = restored & 0xff
    }
    offset += stride
  }
  return out
}

const CHANNELS_BY_COLOUR_TYPE = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }

function decodePng(bytes) {
  const chunks = readChunks(bytes)
  const ihdr = chunks.find((c) => c.type === "IHDR")
  if (!ihdr) throw new Error("PNG has no IHDR")
  const header = new DataView(ihdr.data.buffer, ihdr.data.byteOffset, ihdr.data.byteLength)
  const width = header.getUint32(0)
  const height = header.getUint32(4)
  const depth = ihdr.data[8]
  const colourType = ihdr.data[9]
  if (ihdr.data[12] !== 0) throw new Error("interlaced PNGs are not supported")
  const channels = CHANNELS_BY_COLOUR_TYPE[colourType]
  if (!channels) throw new Error(`unsupported PNG colour type ${colourType}`)
  const bitsPerPixel = channels * depth
  const stride = Math.ceil((width * bitsPerPixel) / 8)
  const bpp = Math.max(1, bitsPerPixel >> 3)
  const raw = inflateSync(Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data)))
  const rows = unfilter(raw, height, stride, bpp)
  const palette = chunks.find((c) => c.type === "PLTE")?.data
  const transparency = chunks.find((c) => c.type === "tRNS")?.data
  const rgba = new Uint8Array(width * height * 4)
  const maxSample = (1 << depth) - 1

  const sampleAt = (row, index) => {
    if (depth === 8) return rows[row * stride + index]
    if (depth === 16) return rows[row * stride + index * 2]
    const bit = index * depth
    const byte = rows[row * stride + (bit >> 3)]
    const shift = 8 - depth - (bit & 7)
    return (byte >> shift) & maxSample
  }
  const to8 = (sample) => (depth === 16 ? sample : Math.round((sample * 255) / maxSample))

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4
      if (colourType === 3) {
        const index = sampleAt(y, x)
        rgba[o] = palette[index * 3]
        rgba[o + 1] = palette[index * 3 + 1]
        rgba[o + 2] = palette[index * 3 + 2]
        rgba[o + 3] = transparency && index < transparency.length ? transparency[index] : 255
      } else if (colourType === 0 || colourType === 4) {
        const grey = to8(sampleAt(y, x * channels))
        rgba[o] = grey
        rgba[o + 1] = grey
        rgba[o + 2] = grey
        rgba[o + 3] = colourType === 4 ? to8(sampleAt(y, x * channels + 1)) : 255
      } else {
        rgba[o] = to8(sampleAt(y, x * channels))
        rgba[o + 1] = to8(sampleAt(y, x * channels + 1))
        rgba[o + 2] = to8(sampleAt(y, x * channels + 2))
        rgba[o + 3] = colourType === 6 ? to8(sampleAt(y, x * channels + 3)) : 255
      }
    }
  }
  return { width, height, rgba }
}

function chunk(type, data) {
  const length = new Uint8Array(4)
  new DataView(length.buffer).setUint32(0, data.length)
  const typed = Uint8Array.from(type, (ch) => ch.charCodeAt(0))
  const body = new Uint8Array(typed.length + data.length)
  body.set(typed, 0)
  body.set(data, typed.length)
  const crc = new Uint8Array(4)
  new DataView(crc.buffer).setUint32(0, crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodeIndexedPng(width, height, indices, palette) {
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  ihdr[8] = 8
  ihdr[9] = 3
  const plte = new Uint8Array(palette.length * 3)
  palette.forEach(([r, g, b], i) => {
    plte[i * 3] = r
    plte[i * 3 + 1] = g
    plte[i * 3 + 2] = b
  })
  const filtered = new Uint8Array((width + 1) * height)
  for (let y = 0; y < height; y += 1) {
    filtered.set(indices.subarray(y * width, (y + 1) * width), y * (width + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from(PNG_SIGNATURE),
    chunk("IHDR", ihdr),
    chunk("PLTE", plte),
    chunk("IDAT", deflateSync(filtered, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ])
}

function colourKey(r, g, b) {
  return (r << 16) | (g << 8) | b
}

function splitBox(box) {
  let best = -1
  let axis = 0
  for (let channel = 0; channel < 3; channel += 1) {
    let lo = 255
    let hi = 0
    for (const entry of box.entries) {
      const v = entry.rgb[channel]
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    if (hi - lo > best) {
      best = hi - lo
      axis = channel
    }
  }
  if (best <= 0) return null
  const sorted = [...box.entries].sort((a, b) => a.rgb[axis] - b.rgb[axis])
  const half = box.count / 2
  let running = 0
  let cut = 0
  while (cut < sorted.length - 1 && running + sorted[cut].count < half) {
    running += sorted[cut].count
    cut += 1
  }
  if (cut === 0) cut = 1
  const left = sorted.slice(0, cut)
  const right = sorted.slice(cut)
  return [
    { entries: left, count: left.reduce((sum, e) => sum + e.count, 0) },
    { entries: right, count: right.reduce((sum, e) => sum + e.count, 0) },
  ]
}

function quantize(rgb, pixelCount) {
  const histogram = new Map()
  for (let i = 0; i < pixelCount; i += 1) {
    const key = colourKey(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2])
    histogram.set(key, (histogram.get(key) ?? 0) + 1)
  }
  const entries = [...histogram].map(([key, count]) => ({
    key,
    count,
    rgb: [key >> 16, (key >> 8) & 0xff, key & 0xff],
  }))
  let boxes = [{ entries, count: pixelCount }]
  while (boxes.length < MAX_PALETTE) {
    boxes.sort((a, b) => b.count * b.entries.length - a.count * a.entries.length)
    let split = null
    let at = -1
    for (let i = 0; i < boxes.length; i += 1) {
      if (boxes[i].entries.length < 2) continue
      split = splitBox(boxes[i])
      if (split) {
        at = i
        break
      }
    }
    if (!split) break
    boxes.splice(at, 1, ...split)
  }
  const palette = []
  const indexByKey = new Map()
  boxes.forEach((box, index) => {
    let r = 0
    let g = 0
    let b = 0
    for (const entry of box.entries) {
      r += entry.rgb[0] * entry.count
      g += entry.rgb[1] * entry.count
      b += entry.rgb[2] * entry.count
      indexByKey.set(entry.key, index)
    }
    palette.push([
      Math.round(r / box.count),
      Math.round(g / box.count),
      Math.round(b / box.count),
    ])
  })
  const indices = new Uint8Array(pixelCount)
  for (let i = 0; i < pixelCount; i += 1) {
    indices[i] = indexByKey.get(colourKey(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]))
  }
  return { palette, indices }
}

function hexToRgb(hex) {
  const n = hex.replace("#", "")
  return [0, 2, 4].map((at) => parseInt(n.slice(at, at + 2), 16))
}

function liftChannel(value, min) {
  return Math.round(min * 255 + (1 - min) * value)
}

const tileCache = new Map()

async function fetchTile(url) {
  const cached = tileCache.get(url)
  if (cached) return cached
  const pending = (async () => {
    const response = await fetch(url, { headers: { "user-agent": USER_AGENT } })
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`)
    return decodePng(new Uint8Array(await response.arrayBuffer()))
  })()
  tileCache.set(url, pending)
  return pending
}

async function mapWithConcurrency(items, limit, work) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next
        next += 1
        results[index] = await work(items[index], index)
      }
    }),
  )
  return results
}

function tileUrl(scheme, z, x, y, shard) {
  const templates = BASEMAP_TILES[scheme]
  const template = templates[shard % templates.length]
  const url = template
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y))
    .replace("{ratio}", TILE_RATIO)
  return withCartoKey(url, CARTO_KEY)
}

function worldPixel(point, zoom) {
  const world = TILE_PX * 2 ** zoom
  const sinLat = Math.sin((point.lat * Math.PI) / 180)
  return {
    x: ((point.lng + 180) / 360) * world,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * world,
  }
}

async function composeStill(scene, scheme) {
  const width = scene.widthPt * STILL_SCALE
  const height = scene.heightPt * STILL_SCALE
  const center = worldPixel(scene.center, scene.zoom)
  const left = Math.round(center.x - width / 2)
  const top = Math.round(center.y - height / 2)
  const tiles = []
  for (let ty = Math.floor(top / TILE_PX); ty <= Math.floor((top + height - 1) / TILE_PX); ty += 1) {
    for (let tx = Math.floor(left / TILE_PX); tx <= Math.floor((left + width - 1) / TILE_PX); tx += 1) {
      tiles.push({ tx, ty })
    }
  }
  const paper = hexToRgb(basemapPaper(scheme))
  const rgb = new Uint8Array(width * height * 3)
  const decoded = await mapWithConcurrency(tiles, FETCH_CONCURRENCY, ({ tx, ty }, i) =>
    fetchTile(tileUrl(scheme, scene.zoom, tx, ty, i)),
  )
  tiles.forEach(({ tx, ty }, i) => {
    const tile = decoded[i]
    const originX = tx * TILE_PX - left
    const originY = ty * TILE_PX - top
    for (let y = 0; y < tile.height; y += 1) {
      const py = originY + y
      if (py < 0 || py >= height) continue
      for (let x = 0; x < tile.width; x += 1) {
        const px = originX + x
        if (px < 0 || px >= width) continue
        const s = (y * tile.width + x) * 4
        const alpha = tile.rgba[s + 3] / 255
        const o = (py * width + px) * 3
        for (let c = 0; c < 3; c += 1) {
          const blended = tile.rgba[s + c] * alpha + paper[c] * (1 - alpha)
          rgb[o + c] = scheme === "dark" ? liftChannel(blended, DARK_RASTER_BRIGHTNESS_MIN) : Math.round(blended)
        }
      }
    }
  })
  return { width, height, rgb, tileCount: tiles.length }
}

function encodeStill(image) {
  const { palette, indices } = quantize(image.rgb, image.width * image.height)
  return encodeIndexedPng(image.width, image.height, indices, palette)
}

function drawSpot(image, fraction, colour) {
  const cx = Math.round(fraction.x * image.width)
  const cy = Math.round(fraction.y * image.height)
  const radius = 7
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue
      const d = Math.hypot(x - cx, y - cy)
      if (d > radius) continue
      const o = (y * image.width + x) * 3
      const ring = d > radius - 2.5
      image.rgb[o] = ring ? 255 : colour[0]
      image.rgb[o + 1] = ring ? 255 : colour[1]
      image.rgb[o + 2] = ring ? 255 : colour[2]
    }
  }
}

function previewSpots(stage) {
  if (stage === "report") return [REPORT_PIN_SPOT]
  if (stage === "track") return [...TRACK_PIN_SPOTS, TRACK_CLUSTER_SPOT]
  return [TOGETHER_EVENT_SPOT]
}

function writePreview(scene, scheme, still) {
  const copy = { ...still, rgb: Uint8Array.from(still.rgb) }
  const spots = previewSpots(scene.stage)
  spots.forEach((spot, i) => {
    const last = scene.stage === "track" && i === spots.length - 1
    drawSpot(copy, fractionInScene(scene, spot), last ? [40, 40, 220] : [230, 60, 60])
  })
  mkdirSync(previewDir, { recursive: true })
  writeFileSync(join(previewDir, `${scene.stage}-${scheme}-preview.png`), encodeStill(copy))
}

mkdirSync(outDir, { recursive: true })
if (!CARTO_KEY) console.warn("no CARTO key resolved from app.config.js; tiles will carry CARTO's watermark")
const manifest = { attribution: DEFAULT_ATTRIBUTION, tileRatio: TILE_RATIO, files: {} }
let totalBytes = 0

for (const stage of ONBOARDING_MAP_STAGES) {
  const scene = ONBOARDING_MAP_SCENES[stage]
  for (const scheme of ONBOARDING_MAP_SCHEMES) {
    const still = await composeStill(scene, scheme)
    if (previewDir) writePreview(scene, scheme, still)
    const png = encodeStill(still)
    const name = mapArtFileName(stage, scheme, STILL_SCALE)
    writeFileSync(join(outDir, name), png)
    totalBytes += png.length
    manifest.files[name] = {
      sha256: createHash("sha256").update(png).digest("hex"),
      width: still.width,
      height: still.height,
      bytes: png.length,
    }
    console.log(
      `${name}  ${still.width}x${still.height}  ${(png.length / 1024).toFixed(0)} KB  (${still.tileCount} tiles, ${scene.place})`,
    )
  }
}

writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`total ${(totalBytes / 1024).toFixed(0)} KB across ${Object.keys(manifest.files).length} stills`)
