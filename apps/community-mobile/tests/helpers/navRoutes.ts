/**
 * Loads @civfix/ui's real nav address map by transpiling `src/nav/routes.ts` in memory: `@civfix/ui/nav` has
 * extensionless imports node's ESM resolver rejects, `routes.ts` is not in the package `exports`, and node
 * refuses to strip types under node_modules (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING), so a by-path import
 * would pass in a linked checkout and fail on a registry install.
 */
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import type * as TypeScript from "typescript"

export async function loadNavRoutes<T>(): Promise<T> {
  const require = createRequire(import.meta.url)
  // Resolved through the package specifier so it follows the same @civfix/ui the app imports.
  const routesPath = join(dirname(require.resolve("@civfix/ui/package.json")), "src", "nav", "routes.ts")
  const ts = require("typescript") as typeof TypeScript
  const { outputText } = ts.transpileModule(readFileSync(routesPath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  })
  return import(`data:text/javascript,${encodeURIComponent(outputText)}`) as Promise<T>
}
