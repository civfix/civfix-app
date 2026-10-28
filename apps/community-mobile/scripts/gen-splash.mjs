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
import { tokens } from "@civfix/tokens"
// eslint-disable-next-line import/no-unresolved -- installed on demand with --no-save (see above), never a dependency
import opentype from "opentype.js"
import sharp from "sharp"

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

const { bloom: BLOOM, sun: SUN, moss: MOSS, sky: SKY, lilac: LILAC } = tokens.logo

// Load Baloo 2 800 and convert the wordmark to vector glyph paths (librsvg's embedded-font support is
// unreliable, so we draw the real letterforms as filled <path>s and color each letter ourselves).
const balooBuf = readFileSync(balooTtfPath)
const balooFont = opentype.parse(
  balooBuf.buffer.slice(balooBuf.byteOffset, balooBuf.byteOffset + balooBuf.byteLength),
)
const WORDMARK = [
  { char: "c", color: BLOOM },
  { char: "i", color: SUN },
  { char: "v", color: MOSS },
  { char: "f", color: SKY },
  { char: "i", color: LILAC },
  { char: "x", color: BLOOM },
]

/**
 * Build per-letter colored glyph <path>s for "civfix" at `fontSize`, centered around (cx, baselineY).
 * Returns an SVG <g> string. Uses the font's own advance widths with a small negative tracking.
 */
/**
 * @param {number} cx
 * @param {number} baselineY
 * @param {number} fontSize
 */
function wordmarkPaths(cx, baselineY, fontSize) {
  const tracking = -fontSize * 0.04
  const scale = fontSize / balooFont.unitsPerEm
  const letters = WORDMARK.map(({ char, color }) => {
    const glyph = balooFont.charToGlyph(char)
    return { glyph, color, advance: glyph.advanceWidth * scale + tracking }
  })
  const totalW = letters.reduce((sum, letter) => sum + letter.advance, 0) - tracking
  let x = cx - totalW / 2
  let out = ""
  for (const { glyph, color, advance } of letters) {
    const path = glyph.getPath(x, baselineY, fontSize)
    path.fill = color
    out += path.toSVG(2)
    x += advance
  }
  return out
}

/**
 * Splash: the per-letter "civfix" wordmark (real Baloo 2 800 glyph paths), centered on a transparent
 * canvas. The field behind it is the splash backgroundColor in app.config.js (the paper token, one
 * value per scheme). It is never painted here, or the light asset would show a bright box in dark mode.
 */
/** @param {number} size */
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
/**
 * @param {string} svg
 * @param {string} out
 * @param {number} size
 */
async function render(svg, out, size) {
  await sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toFile(join(assetsDir, out))
  console.log("wrote", out)
}

await render(splashSvg(1284), "splash.png", 1284)
console.log("done")
