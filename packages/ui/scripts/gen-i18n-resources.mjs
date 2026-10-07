#!/usr/bin/env node
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { CATALOGS_DIR, i18nDir, renderI18nModules } from "./i18n-modules.mjs"

const { modules, summary } = renderI18nModules()

rmSync(join(i18nDir, CATALOGS_DIR), { recursive: true, force: true })
mkdirSync(join(i18nDir, CATALOGS_DIR), { recursive: true })
for (const [path, body] of modules) writeFileSync(join(i18nDir, path), body)

console.log(
  `Wrote ${modules.size} files under ${i18nDir}\n  locales: ${summary.locales.join(", ")} (static on web: ${summary.staticLocale})\n  namespaces: ${summary.namespaces.length}\n  imports: ${summary.importCount}`,
)
