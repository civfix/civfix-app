#!/usr/bin/env node
/**
 * Fails when the committed catalog modules differ from what gen-i18n-resources.mjs would write, e.g. a
 * namespace JSON was added without re-running `i18n:gen`, which leaves the new catalog out of every
 * bundle. It compares in memory and never writes, so a CI run cannot leave the tree dirty.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { CATALOGS_DIR, i18nDir, renderI18nModules } from "./i18n-modules.mjs"

const { modules } = renderI18nModules()
const stale = []
for (const [path, body] of modules) {
  const file = join(i18nDir, path)
  if (!existsSync(file)) stale.push(`missing: src/i18n/${path}`)
  else if (readFileSync(file, "utf8") !== body) stale.push(`differs: src/i18n/${path}`)
}
for (const name of readdirSync(join(i18nDir, CATALOGS_DIR))) {
  if (!modules.has(`${CATALOGS_DIR}/${name}`)) stale.push(`not generated: src/i18n/${CATALOGS_DIR}/${name}`)
}

if (stale.length) {
  console.error(
    `i18n resources are stale; run \`pnpm --filter @civfix/ui i18n:gen\` and commit the result:\n  ${stale.join("\n  ")}`,
  )
  process.exit(1)
}
console.log(`i18n resources fresh: ${modules.size} generated modules match src/i18n.`)
