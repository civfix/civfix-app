// Copy the self-hosted woff2 files for the 12 "contract" font-family names into public/fonts/.
//
// WHY THIS EXISTS:
//   The unified @civfix/ui component set renders shared typography via react-native-web, which emits
//   raw `font-family: "Manrope_600SemiBold"` (etc.) strings - the exact @expo-google-fonts family
//   names the native app registers. The web app's next/font setup registers Bricolage/Manrope/
//   JetBrains under hashed, framework-internal family names (and ships NO Baloo 2 or Manrope 800), so
//   those literal names resolve to NOTHING on web. This step self-hosts each weight under its literal
//   contract name via a real @font-face (see src/styles/contract-fonts.css), which is the only way to
//   pin an arbitrary family name (next/font cannot). Copying into public/ (absolute /fonts/... URLs)
//   is the most robust option for the static export (output: "export") - no bundler URL resolution.
//
// Contract font source files come straight from the installed @fontsource packages. Hanken Grotesk is
// not an installed package dependency, so its tracked Google Fonts CDN bytes, checksum, provenance,
// and OFL license are verified below on every build instead of relying on an implicit network fetch.
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, copyFileSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const appRoot = join(here, "..")
const outDir = join(appRoot, "public", "fonts")

const HANKEN = {
  font: join(outDir, "HankenGrotesk_Variable.woff2"),
  license: join(outDir, "HankenGrotesk-OFL.txt"),
  provenance: join(outDir, "HankenGrotesk-PROVENANCE.md"),
  sha256: "1f21c6eaa0000f3329cfcfac966b43d5bebf5aa610303e33294ac31bc6f4bb59",
  source:
    "https://fonts.gstatic.com/s/hankengrotesk/v12/ieVn2YZDLWuGJpnzaiwFXS9tYtpd59CxCis4.woff2",
}

// Each entry: the literal contract family name -> the @fontsource package + its latin woff2 file.
// The destination filename is the literal family name so the mapping is self-documenting in public/.
const FONTS = [
  // Bricolage Grotesque (display / headings)
  { family: "BricolageGrotesque_400Regular", pkg: "@fontsource/bricolage-grotesque", file: "bricolage-grotesque-latin-400-normal.woff2" },
  { family: "BricolageGrotesque_500Medium", pkg: "@fontsource/bricolage-grotesque", file: "bricolage-grotesque-latin-500-normal.woff2" },
  { family: "BricolageGrotesque_600SemiBold", pkg: "@fontsource/bricolage-grotesque", file: "bricolage-grotesque-latin-600-normal.woff2" },
  { family: "BricolageGrotesque_700Bold", pkg: "@fontsource/bricolage-grotesque", file: "bricolage-grotesque-latin-700-normal.woff2" },
  // Manrope (body / UI), including the 800 weight web previously lacked entirely.
  { family: "Manrope_400Regular", pkg: "@fontsource/manrope", file: "manrope-latin-400-normal.woff2" },
  { family: "Manrope_500Medium", pkg: "@fontsource/manrope", file: "manrope-latin-500-normal.woff2" },
  { family: "Manrope_600SemiBold", pkg: "@fontsource/manrope", file: "manrope-latin-600-normal.woff2" },
  { family: "Manrope_700Bold", pkg: "@fontsource/manrope", file: "manrope-latin-700-normal.woff2" },
  { family: "Manrope_800ExtraBold", pkg: "@fontsource/manrope", file: "manrope-latin-800-normal.woff2" },
  // JetBrains Mono (numeric / mono)
  { family: "JetBrainsMono_400Regular", pkg: "@fontsource/jetbrains-mono", file: "jetbrains-mono-latin-400-normal.woff2" },
  { family: "JetBrainsMono_500Medium", pkg: "@fontsource/jetbrains-mono", file: "jetbrains-mono-latin-500-normal.woff2" },
  // Baloo 2 800: the per-letter "civfix" wordmark.
  { family: "Baloo2_800ExtraBold", pkg: "@fontsource/baloo-2", file: "baloo-2-latin-800-normal.woff2" },
]

// Resolve a package's installed directory via its package.json (works under pnpm's symlinked layout).
function pkgFilesDir(pkg) {
  const pkgJson = require.resolve(`${pkg}/package.json`)
  return join(dirname(pkgJson), "files")
}

mkdirSync(outDir, { recursive: true })

function verifyHankenGrotesk() {
  for (const [kind, path] of Object.entries({
    font: HANKEN.font,
    license: HANKEN.license,
    provenance: HANKEN.provenance,
  })) {
    if (!existsSync(path)) throw new Error(`Missing vendored Hanken Grotesk ${kind}: ${path}`)
  }

  const digest = createHash("sha256").update(readFileSync(HANKEN.font)).digest("hex")
  if (digest !== HANKEN.sha256) {
    throw new Error(`Hanken Grotesk checksum mismatch: expected ${HANKEN.sha256}, received ${digest}`)
  }

  const license = readFileSync(HANKEN.license, "utf8")
  if (!license.includes("SIL OPEN FONT LICENSE Version 1.1")) {
    throw new Error("Hanken Grotesk OFL license is incomplete")
  }

  const provenance = readFileSync(HANKEN.provenance, "utf8")
  if (!provenance.includes(HANKEN.source) || !provenance.includes(HANKEN.sha256)) {
    throw new Error("Hanken Grotesk provenance does not match the pinned source and checksum")
  }

  console.log(
    `  HankenGrotesk_Variable.woff2  <-  pinned Google Fonts CDN asset  (${statSync(HANKEN.font).size} bytes, sha256 verified)`,
  )
}

verifyHankenGrotesk()

let copied = 0
const missing = []
for (const { family, pkg, file } of FONTS) {
  const src = join(pkgFilesDir(pkg), file)
  if (!existsSync(src)) {
    missing.push(`${family} (${pkg}/files/${file})`)
    continue
  }
  const dest = join(outDir, `${family}.woff2`)
  copyFileSync(src, dest)
  copied += 1
  console.log(`  ${family}.woff2  <-  ${pkg}/files/${file}  (${statSync(dest).size} bytes)`)
}

if (missing.length > 0) {
  console.error(`\ncopy-contract-fonts: ${missing.length} source woff2 file(s) NOT found:`)
  for (const m of missing) console.error(`  - ${m}`)
  console.error("Did the @fontsource/* devDependencies install? Aborting so the gap is loud.")
  process.exit(1)
}

console.log(`\ncopy-contract-fonts: copied ${copied}/${FONTS.length} contract font files into public/fonts/.`)
