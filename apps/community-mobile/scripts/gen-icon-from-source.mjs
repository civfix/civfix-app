// scripts/gen-icon-from-source.mjs
// Generates the civfix wordmark app icons from a single source PNG.
//   node scripts/gen-icon-from-source.mjs            (defaults to assets/icon-source.png)
//   node scripts/gen-icon-from-source.mjs path/to.png
// sharp is a dev-only tool, hoisted at the civfix monorepo root (verified 0.35.0).
//
// The source artwork ships on an OPAQUE near-neutral light field (~rgb(245,246,246)), not transparency.
// So before fitting we normalize that background to brand cream: every near-neutral very-light pixel (and
// any transparent pixel) is repainted cream, and semi-transparent edge pixels are composited over cream.
// This yields a uniform cream field with the saturated wordmark intact (letter counters become cream too),
// so the icon reads as "wordmark perfectly centered, padded on cream" with no visible inner rectangle.
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const sharp = require("sharp")

const here = dirname(fileURLToPath(import.meta.url))
const assetsDir = join(here, "..", "assets")
const SRC = resolve(process.argv[2] ?? join(assetsDir, "icon-source.png"))

const CREAM = "#FBF7F0"
const CR = 0xfb, CG = 0xf7, CB = 0xf0 // cream as bytes
const ICON = 1024
const ICON_PAD = 0.82 // wordmark occupies ~82% of the square (cream margin all around)
const SAFE = 0.66 // Android adaptive safe-zone fraction
const FAVICON = 64 // Expo web favicon

// Repaint the near-neutral light background (and any transparency) to cream; flatten semi-transparent
// edges over cream. Returns an opaque RGBA PNG buffer the emitters fit/center on a cream canvas.
async function normalizeToCream(srcPath) {
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const ch = info.channels // 4
  for (let i = 0; i < data.length; i += ch) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
    const lo = Math.min(r, g, b), hi = Math.max(r, g, b)
    if (a < 16 || (hi - lo <= 16 && lo >= 218)) {
      // transparent OR low-chroma very-light = background -> cream
      data[i] = CR; data[i + 1] = CG; data[i + 2] = CB; data[i + 3] = 255
    } else if (a < 255) {
      // semi-transparent edge -> composite over cream
      const af = a / 255
      data[i] = Math.round(r * af + CR * (1 - af))
      data[i + 1] = Math.round(g * af + CG * (1 - af))
      data[i + 2] = Math.round(b * af + CB * (1 - af))
      data[i + 3] = 255
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: ch } }).png().toBuffer()
}

// (1) iOS marketing icon: contained + centered on cream, FLATTENED no-alpha (channels 3).
async function genIcon(srcBuf) {
  const inner = Math.round(ICON * ICON_PAD)
  const fitted = await sharp(srcBuf).resize(inner, inner, { fit: "contain", background: CREAM }).toBuffer()
  await sharp({ create: { width: ICON, height: ICON, channels: 3, background: CREAM } })
    .composite([{ input: fitted, gravity: "center" }])
    .flatten({ background: CREAM })
    .removeAlpha() // iOS rejects alpha -> force channels 3 (verified hasAlpha:false)
    .png()
    .toFile(join(assetsDir, "icon.png"))
  console.log("wrote icon.png (1024 no-alpha)")
}

// (2) Android adaptive foreground: wordmark into the ~66% safe zone, on CREAM (matches new
// android.adaptiveIcon.backgroundColor). Kept RGBA so the launcher mask blends cleanly.
async function genAdaptive(srcBuf) {
  const safe = Math.round(ICON * SAFE)
  const fitted = await sharp(srcBuf).resize(safe, safe, { fit: "contain", background: CREAM }).toBuffer()
  await sharp({ create: { width: ICON, height: ICON, channels: 4, background: CREAM } })
    .composite([{ input: fitted, gravity: "center" }])
    .png()
    .toFile(join(assetsDir, "adaptive-icon.png"))
  console.log("wrote adaptive-icon.png (1024, cream safe-zone)")
}

// (3) Web favicon.
async function genFavicon(srcBuf) {
  const inner = Math.round(FAVICON * ICON_PAD)
  const fitted = await sharp(srcBuf).resize(inner, inner, { fit: "contain", background: CREAM }).toBuffer()
  await sharp({ create: { width: FAVICON, height: FAVICON, channels: 3, background: CREAM } })
    .composite([{ input: fitted, gravity: "center" }])
    .flatten({ background: CREAM })
    .removeAlpha()
    .png()
    .toFile(join(assetsDir, "favicon.png"))
  console.log("wrote favicon.png (64)")
}

const cleaned = await normalizeToCream(SRC)
await genIcon(cleaned)
await genAdaptive(cleaned)
await genFavicon(cleaned)
console.log("done")
