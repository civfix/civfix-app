/**
 * Generates assets/splash.png (1284x1284): the per-letter "civfix" wordmark (Baloo 2) on a fully
 * transparent canvas, so the expo-splash-screen plugin paints the paper token behind it in light AND
 * dark mode and no baked field can drift from that token. The app icons come from
 * scripts/gen-icon-from-source.mjs instead.
 *
 * Run from apps/community-mobile:  node scripts/gen-splash.mjs
 * sharp + opentype.js are dev-only tools (install at repo root with --no-save); not runtime deps.
 */
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const sharp = require("sharp")
const opentype = require("opentype.js")

const here = dirname(fileURLToPath(import.meta.url))
const appDir = join(here, "..")
const assetsDir = join(appDir, "assets")
const balooTtfPath = join(
  appDir,
  "..",
  "..",
  "node_modules",
  "@expo-google-fonts",
  "baloo-2",
  "800ExtraBold",
  "Baloo2_800ExtraBold.ttf",
)

// Brand colors (from colors_and_type.css).
const SUN_600 = "#E5AE1C"
const MOSS = "#6FB36F"
const SKY = "#6FB1DC"
const LILAC = "#9C82DE"
const BLOOM = "#FF7A6B"

// Load Baloo 2 800 and convert the wordmark to vector glyph paths (librsvg's embedded-font support is
// unreliable, so we draw the real letterforms as filled <path>s and color each letter ourselves).
const balooBuf = readFileSync(balooTtfPath)
const balooFont = opentype.parse(
  balooBuf.buffer.slice(balooBuf.byteOffset, balooBuf.byteOffset + balooBuf.byteLength),
)
const WORD = "civfix"
const WORD_COLORS = [BLOOM, SUN_600, MOSS, SKY, LILAC, BLOOM] // c i v f i x

/**
 * Build per-letter colored glyph <path>s for "civfix" at `fontSize`, centered around (cx, baselineY).
 * Returns an SVG <g> string. Uses the font's own advance widths with a small negative tracking.
 */
function wordmarkPaths(cx, baselineY, fontSize) {
  const tracking = -fontSize * 0.04
  const scale = fontSize / balooFont.unitsPerEm
  const glyphs = WORD.split("").map((ch) => balooFont.charToGlyph(ch))
  const advances = glyphs.map((g) => g.advanceWidth * scale + tracking)
  const totalW = advances.reduce((a, b) => a + b, 0) - tracking
  let x = cx - totalW / 2
  let out = ""
  glyphs.forEach((g, i) => {
    const path = g.getPath(x, baselineY, fontSize)
    path.fill = WORD_COLORS[i]
    out += path.toSVG(2)
    x += advances[i]
  })
  return out
}

/**
 * Splash: the per-letter "civfix" wordmark (real Baloo 2 800 glyph paths), centered on a transparent
 * canvas. The field behind it is the splash backgroundColor in app.config.js (the paper token, one
 * value per scheme) — never painted here, or the light asset would show a bright box in dark mode.
 */
function splashSvg(size) {
  // Larger wordmark so the logo reads at a comfortable size once `contain`-fit on a tall phone (the
  // previous 0.165 left it looking tiny in the big square canvas).
  const fs = Math.round(size * 0.28)
  // Baloo's cap/ascender sits above the baseline; place the baseline a bit below center so the
  // lowercase word is optically centered.
  const baseline = Math.round(size * 0.52 + fs * 0.32)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${wordmarkPaths(size / 2, baseline, fs)}
  </svg>`
}

/** Rasterize an SVG string to a PNG in assetsDir. Renders large (density) then downscales for crisp edges. */
async function render(svg, out, size) {
  await sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toFile(join(assetsDir, out))
  console.log("wrote", out)
}

await render(splashSvg(1284), "splash.png", 1284)
console.log("done")
