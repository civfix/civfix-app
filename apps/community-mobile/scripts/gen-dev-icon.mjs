// Generates assets/icon-dev.png, the home-screen icon of the development variant (CIVFIX_APP_VARIANT in
// app.config.js): the store icon with a "DEV" band, so the two installs are told apart at a glance.
//   node scripts/gen-dev-icon.mjs
// Re-run it whenever assets/icon.png changes. sharp is hoisted at the civfix monorepo root.
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { tokens } from "@civfix/tokens"
import sharp from "sharp"

const assetsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "assets")
const ICON = 1024
const BAND = 220

const band = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON}" height="${BAND}">` +
    `<rect width="100%" height="100%" fill="${tokens.color.semantic.selectedFill}"/>` +
    `<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" ` +
    `font-weight="700" font-size="150" letter-spacing="24" fill="${tokens.color.semantic.selectedInk}">DEV</text></svg>`,
)

await sharp(join(assetsDir, "icon.png"))
  .resize(ICON, ICON)
  .composite([{ input: band, top: ICON - BAND, left: 0 }])
  .png()
  .toFile(join(assetsDir, "icon-dev.png"))
console.log("wrote assets/icon-dev.png")
