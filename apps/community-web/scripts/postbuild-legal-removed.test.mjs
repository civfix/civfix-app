import { spawnSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import * as gates from "./postbuild-gates.mjs"

const appDir = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const publicDir = join(appDir, "public")

const BRANDED_HEAD = [
  '<meta property="og:site_name" content="civfix"/>',
  '<meta property="og:type" content="website"/>',
  '<meta property="og:locale" content="en_US"/>',
  '<meta property="og:title" content="civfix"/>',
  '<meta property="og:description" content="Report it."/>',
  '<meta property="og:image" content="https://civfix.test/og.png"/>',
  '<meta property="og:image:secure_url" content="https://civfix.test/og.png"/>',
  '<meta property="og:image:type" content="image/png"/>',
  '<meta property="og:image:width" content="1200"/>',
  '<meta property="og:image:height" content="630"/>',
  '<meta property="og:image:alt" content="civfix"/>',
  '<meta name="twitter:card" content="summary_large_image"/>',
  '<meta name="twitter:title" content="civfix"/>',
  '<meta name="twitter:description" content="Report it."/>',
  '<meta name="twitter:image" content="https://civfix.test/og.png"/>',
  '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"/>',
].join("")

// The gate resolves out/ and public/ from its own location, so it runs from a copy of the app beside an
// export that passes every other check.
function fakeApp() {
  const root = mkdtempSync(join(tmpdir(), "civfix-postbuild-"))
  mkdirSync(join(root, "scripts"))
  for (const script of ["cf-pages-postbuild.mjs", "postbuild-gates.mjs", "robots-policy.mjs"]) {
    copyFileSync(join(appDir, "scripts", script), join(root, "scripts", script))
  }
  // The workspace hoists its dependencies to the repository root.
  symlinkSync(join(appDir, "..", "..", "node_modules"), join(root, "node_modules"))
  symlinkSync(join(appDir, "functions"), join(root, "functions"))

  const out = join(root, "out")
  mkdirSync(join(out, "_next", "static", "chunks"), { recursive: true })
  for (const file of ["_redirects", "_routes.json", "_headers", "og.png", "apple-touch-icon.png"]) {
    copyFileSync(join(publicDir, file), join(out, file))
  }
  mkdirSync(join(out, ".well-known"))
  copyFileSync(join(publicDir, ".well-known", "apple-app-site-association"), join(out, ".well-known", "apple-app-site-association"))
  for (const page of ["index.html", "404.html"]) {
    writeFileSync(join(out, page), `<html><head>${BRANDED_HEAD}</head><body></body></html>`)
  }
  writeFileSync(join(out, "_next", "static", "chunks", "app.js"), 'class E extends Error{constructor(){super();this.name="AppError"}}')
  for (const type of ["terms", "privacy", "cookies", "subprocessors"]) {
    mkdirSync(join(out, "legal", type), { recursive: true })
    writeFileSync(join(out, "legal", type, "index.html"), '<html><body><div id="__next"></div></body></html>')
  }
  return root
}

describe("the postbuild gate without its legal checks", () => {
  let root = ""

  beforeAll(() => {
    root = fakeApp()
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it("T1: passes an export whose legal pages carry no legal-prose article, and says nothing about them", () => {
    const run = spawnSync(process.execPath, [join(root, "scripts", "cf-pages-postbuild.mjs")], {
      encoding: "utf8",
      env: { ...process.env, NEXT_PUBLIC_SITE_URL: "https://civfix.test" },
    })
    const lines = `${run.stdout}\n${run.stderr}`.split("\n")
    expect(lines.filter((line) => line.includes("legal document"))).toEqual([])
    expect(run.status, run.stderr).toBe(0)
  })
})

describe("the gate module", () => {
  it("T2: exports no legal hashing, and the AASA gate still keeps /legal/* in the browser", () => {
    for (const name of ["extractLegalArticle", "legalDocumentHash", "isPlaceholderLegalHash", "renderedLegalDocuments"]) {
      expect(Object.keys(gates), name).not.toContain(name)
    }
    expect(gates.REQUIRED_AASA_EXCLUDES).toContain("/legal/*")
  })
})

describe("the legal hash script", () => {
  it("T4: is gone, with its package script", () => {
    const pkg = JSON.parse(readFileSync(join(appDir, "package.json"), "utf8"))
    expect(Object.keys(pkg.scripts)).not.toContain("legal-hashes")
    expect(existsSync(join(appDir, "scripts", "legal-hashes.mjs"))).toBe(false)
  })
})
