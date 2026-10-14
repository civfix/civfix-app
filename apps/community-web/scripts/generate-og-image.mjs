import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { OG_IMAGE_MAX_BYTES } from "./postbuild-gates.mjs"

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const publicDir = join(appDir, "public")

const OG_WIDTH = 1200
const OG_HEIGHT = 630
const ICON_SIZE = 180

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/opt/homebrew/bin/chromium",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
].filter(Boolean)

const chrome = CHROME_CANDIDATES.find((candidate) => existsSync(candidate))
if (!chrome) {
  console.error(
    `[og] no Chrome/Chromium binary found. Set CHROME_BIN=<path> and re-run. Tried:\n  ` +
      CHROME_CANDIDATES.join("\n  "),
  )
  process.exit(1)
}

const { tokens } = await import("@civfix/shared/tokens")

const WORDMARK = [
  { char: "c", color: tokens.color.brand.bloom },
  { char: "i", color: tokens.color.sun["600"] },
  { char: "v", color: tokens.color.brand.moss },
  { char: "f", color: tokens.color.brand.sky },
  { char: "i", color: tokens.color.brand.lilac },
  { char: "x", color: tokens.color.brand.bloom },
]

const pin = readFileSync(join(publicDir, "favicon.svg"), "utf8")
const baloo = readFileSync(join(publicDir, "fonts", "Baloo2_800ExtraBold.woff2")).toString("base64")

function pinSvg(size) {
  return pin.replace("<svg", `<svg width="${size}" height="${size}"`)
}

const ogHtml = `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face {
  font-family: "Baloo 2";
  font-weight: 800;
  font-display: block;
  src: url(data:font/woff2;base64,${baloo}) format("woff2");
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${OG_WIDTH}px; height: ${OG_HEIGHT}px; }
body {
  background: ${tokens.color.neutral.paper};
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 34px;
  font-family: "Baloo 2", sans-serif;
}
.pin { width: 190px; height: 190px; display: block; }
.wordmark { display: flex; align-items: baseline; font-size: 132px; font-weight: 800; letter-spacing: -5px; line-height: 1; }
.tagline {
  font-family: system-ui, sans-serif; font-weight: 600; font-size: 34px; letter-spacing: 0.2px;
  color: ${tokens.color.neutral.ink2};
}
</style></head>
<body>
  <div class="pin">${pinSvg(190)}</div>
  <div class="wordmark">${WORDMARK.map((l) => `<span style="color:${l.color}">${l.char}</span>`).join("")}</div>
  <div class="tagline">Report it. Track it. Fix your block.</div>
</body></html>
`

const iconHtml = `<!doctype html>
<html><head><meta charset="utf-8"><style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${ICON_SIZE}px; height: ${ICON_SIZE}px; }
body {
  background: ${tokens.color.neutral.paper};
  display: flex; align-items: center; justify-content: center;
}
.pin { width: 128px; height: 128px; display: block; }
</style></head>
<body><div class="pin">${pinSvg(128)}</div></body></html>
`

const TARGETS = [
  { name: "og.png", html: ogHtml, width: OG_WIDTH, height: OG_HEIGHT, maxBytes: OG_IMAGE_MAX_BYTES },
  { name: "apple-touch-icon.png", html: iconHtml, width: ICON_SIZE, height: ICON_SIZE },
]

const workDir = mkdtempSync(join(tmpdir(), "civfix-og-"))

try {
  for (const target of TARGETS) {
    const outFile = join(publicDir, target.name)
    const htmlFile = join(workDir, `${target.name}.html`)
    writeFileSync(htmlFile, target.html, "utf8")

    execFileSync(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        `--window-size=${target.width},${target.height}`,
        `--screenshot=${outFile}`,
        "--virtual-time-budget=4000",
        `file://${htmlFile}`,
      ],
      { stdio: "inherit" },
    )

    // Set exitCode and break rather than exiting here: an exit skips the finally that removes workDir.
    if (!existsSync(outFile)) {
      console.error(`[og] ${outFile} was not written.`)
      process.exitCode = 1
      break
    }

    const bytes = statSync(outFile).size
    if (target.maxBytes && bytes > target.maxBytes) {
      console.error(
        `[og] ${target.name} is ${bytes} bytes, over the ${target.maxBytes}-byte budget. WhatsApp ` +
          `drops a preview image above ~300 KB, so simplify the artwork and re-run.`,
      )
      process.exitCode = 1
      break
    }

    console.log(
      `[og] wrote ${outFile} (${target.width}x${target.height}, ${bytes} bytes) using ${chrome}`,
    )
  }
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
