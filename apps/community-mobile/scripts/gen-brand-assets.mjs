/**
 * One-off generator for the branded app icon + splash PNGs (replaces the blank cream placeholders).
 *
 * The icon artwork is the civfix map-pin, kept as vector source next to the assets and rasterized
 * here with sharp (librsvg):
 *   - assets/icon.png            1024x1024  from assets/app-icon.svg — flat coral field + white pin
 *                                           with a coral hole + soft drop shadow. Flattened (no alpha)
 *                                           so iOS accepts it; iOS/Android apply their own corner mask.
 *   - assets/adaptive-icon.png   1024x1024  from assets/adaptive-icon.svg — transparent foreground,
 *                                           the white pin scaled into the Android adaptive safe zone.
 *                                           The coral field is app.config android.adaptiveIcon
 *                                           .backgroundColor (#EA4F3D) and shows through the pin hole.
 *   - assets/favicon.png          256x256   the same app-icon.svg, for the Expo web export.
 *   - assets/splash.png          1284x1284  paper cream + the per-letter "civfix" wordmark (Baloo 2)
 *
 * To change the icon, edit assets/app-icon.svg (and assets/adaptive-icon.svg) — they are the source
 * of truth — then re-run this script. Native launcher resources are regenerated from these PNGs by
 * `expo prebuild`.
 *
 * Run from apps/community-mobile:  node scripts/gen-brand-assets.mjs
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
const PAPER = "#FBF7F0"
const SUN_600 = "#E5AE1C"
const MOSS = "#6FB36F"
const SKY = "#6FB1DC"
const LILAC = "#9C82DE"
const BLOOM = "#FF7A6B"
// The icon coral — app-icon.svg's flat field; also app.config android.adaptiveIcon.backgroundColor.
const ICON_CORAL = "#EA4F3D"

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

/** Splash: paper field + the per-letter "civfix" wordmark (real Baloo 2 800 glyph paths), centered. */
function splashSvg(size) {
  // Larger wordmark so the logo reads at a comfortable size once `contain`-fit on a tall phone (the
  // previous 0.165 left it looking tiny in the big square canvas).
  const fs = Math.round(size * 0.28)
  // Baloo's cap/ascender sits above the baseline; place the baseline a bit below center so the
  // lowercase word is optically centered.
  const baseline = Math.round(size * 0.52 + fs * 0.32)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect x="0" y="0" width="${size}" height="${size}" fill="${PAPER}"/>
    ${wordmarkPaths(size / 2, baseline, fs)}
  </svg>`
}

/** Rasterize an SVG string to a PNG in assetsDir. Renders large (density) then downscales for crisp edges. */
async function render(svg, out, size) {
  await sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toFile(join(assetsDir, out))
  console.log("wrote", out)
}

/** Rasterize one of the committed icon source SVGs. `flatten` drops alpha onto the coral (for iOS). */
async function renderAsset(srcSvg, out, size, { flatten } = {}) {
  let img = sharp(readFileSync(join(assetsDir, srcSvg)), { density: 384 }).resize(size, size)
  if (flatten) img = img.flatten({ background: ICON_CORAL })
  await img.png().toFile(join(assetsDir, out))
  console.log("wrote", out)
}

await renderAsset("app-icon.svg", "icon.png", 1024, { flatten: true })
await renderAsset("adaptive-icon.svg", "adaptive-icon.png", 1024)
await render(splashSvg(1284), "splash.png", 1284)
// Web favicon (Expo web export): the full app icon scaled down.
await renderAsset("app-icon.svg", "favicon.png", 256, { flatten: true })
console.log("done")
