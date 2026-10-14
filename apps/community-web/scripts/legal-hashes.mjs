import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { LEGAL_DOCUMENTS } from "@civfix/shared/legal"

import { isPlaceholderLegalHash, renderedLegalDocuments } from "./postbuild-gates.mjs"

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(appDir, "out")
const legalOutDir = join(outDir, "legal")

if (!existsSync(legalOutDir)) {
  console.error(
    `[legal-hashes] no export found at ${legalOutDir}. The hash is taken from the SERVED HTML, not ` +
      `from source, so the canonical text is exactly what a reader saw. Run \`pnpm build\` first.`,
  )
  process.exit(1)
}

const rows = renderedLegalDocuments(outDir)
  .filter(({ type, hashed }) => type !== null && hashed !== null)
  .map(({ route, type, hashed }) => ({
    type,
    route: `/legal/${route}`,
    version: hashed.version,
    sha256: hashed.sha256,
  }))

rows.sort((a, b) => a.type.localeCompare(b.type))

const declaredTypes = new Set(LEGAL_DOCUMENTS.map((document) => document.type))
const renderedTypes = new Set(rows.map((row) => row.type))
const unrendered = [...declaredTypes].filter((type) => !renderedTypes.has(type)).sort()

for (const row of rows) {
  const declared = LEGAL_DOCUMENTS.find((document) => document.type === row.type)
  const state =
    declared === undefined
      ? "NOT IN LEGAL_DOCUMENTS"
      : isPlaceholderLegalHash(row.type, declared.version, declared.sha256)
        ? "placeholder in contract"
        : declared.sha256 === row.sha256
          ? "matches contract"
          : "DRIFT vs contract"
  console.log(`${row.type.padEnd(24)} ${row.version ?? "(no version)"}  ${row.sha256}  ${state}`)
}

if (unrendered.length > 0) {
  console.error(
    `\n[legal-hashes] ERROR: no /legal/<slug> page renders: ${unrendered.join(", ")}. Every type in ` +
      `LEGAL_DOCUMENTS must have a rendered page, or its hash is a number that verifies no text.`,
  )
  process.exitCode = 1
}

const outPath = process.env.LEGAL_HASHES_OUT
if (outPath) {
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        note: "sha256 over the canonical plain text of each rendered <article class=\"legal-prose\">; version + effectiveAt + sha256 must be updated as ONE edit in packages/shared/src/legal/documents.ts",
        documents: rows,
        unrendered,
      },
      null,
      2,
    )}\n`,
  )
  console.log(`\n[legal-hashes] wrote ${outPath}`)
}
