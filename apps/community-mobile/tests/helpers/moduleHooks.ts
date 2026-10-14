import { existsSync } from "node:fs"
import { registerHooks } from "node:module"
import { fileURLToPath } from "node:url"

const SRC_DIR = new URL("../../src/", import.meta.url)

function sourceUrlFor(specifier: string): string | null {
  const base = new URL(specifier.slice("@/".length), SRC_DIR).href
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (existsSync(fileURLToPath(candidate))) return candidate
  }
  return null
}

// Node cannot resolve the app's "@/" path alias or load native modules, so a store test swaps the
// native-backed modules for in-memory stubs and resolves every other "@/" import to its real source.
export function installModuleStubs(stubs: Readonly<Record<string, URL>>): void {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const stub = stubs[specifier]
      if (stub) return { url: stub.href, shortCircuit: true }
      if (specifier.startsWith("@/")) {
        const url = sourceUrlFor(specifier)
        if (url) return { url, shortCircuit: true }
      }
      return nextResolve(specifier, context)
    },
  })
}
