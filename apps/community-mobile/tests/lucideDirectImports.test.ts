import assert from "node:assert/strict"
import { test } from "node:test"
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

type ImportNode = {
  type: string
  source?: { value: string } | null
  importKind?: string
  specifiers?: { type: string; importKind?: string }[]
}

interface BabelConfigExports {
  lucideDirectImports: unknown
  lucideBarrelExports: (barrelFile: string) => Map<string, { file: string }>
}

/** The slice of @babel/core these tests drive; the package ships no types of its own. */
interface BabelCore {
  transformSync: (code: string, options: Record<string, unknown>) => { code: string }
  parseSync: (code: string, options: Record<string, unknown>) => { program: { body: ImportNode[] } }
}

const require = createRequire(import.meta.url)
const { lucideDirectImports, lucideBarrelExports } = require("../babel.config.js") as BabelConfigExports
// community-mobile declares no @babel/core; resolve the one Metro transforms with (expo -> babel-preset-expo).
const presetRequire = createRequire(
  createRequire(require.resolve("expo/package.json")).resolve("babel-preset-expo/package.json"),
)
const babel = presetRequire("@babel/core") as BabelCore

const BARRELS = new Set(["lucide-react-native", "lucide-react-native/icons"])
const installedEsmDir = join(require.resolve("lucide-react-native"), "..", "..", "esm")

function fakeLucide(): string {
  const esmDir = mkdtempSync(join(tmpdir(), "lucide-esm-"))
  mkdirSync(join(esmDir, "icons"))
  writeFileSync(
    join(esmDir, "lucide-react-native.mjs"),
    [
      "/** @license */",
      "export { LucideProvider, useLucideContext } from './context.mjs';",
      "export { default as createLucideIcon } from './createLucideIcon.mjs';",
      "export { default as Icon } from './Icon.mjs';",
      "export { default as Check, default as CheckIcon, default as LucideCheck } from './icons/check.mjs';",
      "export { default as House, default as Home, default as HouseIcon } from './icons/house.mjs';",
      "//# sourceMappingURL=lucide-react-native.mjs.map",
    ].join("\n"),
  )
  writeFileSync(
    join(esmDir, "icons", "index.mjs"),
    ["export { default as Check } from './check.mjs';", "export { default as House } from './house.mjs';"].join("\n"),
  )
  return esmDir
}

function transform(code: string, esmDir: string): string {
  const out = babel.transformSync(code, {
    babelrc: false,
    configFile: false,
    filename: "input.tsx",
    plugins: [[lucideDirectImports, { esmDir }]],
    parserOpts: { plugins: ["typescript", "jsx"] },
  })
  return out.code
}

function withFake(fn: (esmDir: string, at: (file: string) => string) => void): void {
  const esmDir = fakeLucide()
  try {
    fn(esmDir, (file) => JSON.stringify(join(esmDir, file)))
  } finally {
    rmSync(esmDir, { recursive: true })
  }
}

test("icon imports and renamed aliases from either barrel become per-icon default imports", () => {
  withFake((esmDir, at) => {
    const out = transform(
      'import { Check, House as HomeIcon } from "lucide-react-native/icons"\nimport { Home, LucideCheck } from "lucide-react-native"',
      esmDir,
    )
    assert.ok(out.includes(`import Check from ${at("icons/check.mjs")}`), out)
    assert.ok(out.includes(`import HomeIcon from ${at("icons/house.mjs")}`), out)
    assert.ok(out.includes(`import Home from ${at("icons/house.mjs")}`), out)
    assert.ok(out.includes(`import LucideCheck from ${at("icons/check.mjs")}`), out)
    assert.ok(!out.includes('"lucide-react-native'), out)
  })
})

test("non-icon value exports go to their own modules, so nothing loads the barrel", () => {
  withFake((esmDir, at) => {
    const out = transform(
      'import { Icon, createLucideIcon, LucideProvider, useLucideContext as useCtx } from "lucide-react-native"',
      esmDir,
    )
    assert.ok(out.includes(`import Icon from ${at("Icon.mjs")}`), out)
    assert.ok(out.includes(`import createLucideIcon from ${at("createLucideIcon.mjs")}`), out)
    assert.ok(out.includes(`import { LucideProvider } from ${at("context.mjs")}`), out)
    assert.ok(out.includes(`import { useLucideContext as useCtx } from ${at("context.mjs")}`), out)
    assert.ok(!out.includes('"lucide-react-native'), out)
  })
})

test("re-exports from a barrel are rewritten the same way", () => {
  withFake((esmDir, at) => {
    const out = transform(
      'export { Check, Icon as Glyph, type LucideProps } from "lucide-react-native"\nexport type { LucideIcon } from "lucide-react-native"',
      esmDir,
    )
    assert.ok(out.includes(`export { default as Check } from ${at("icons/check.mjs")}`), out)
    assert.ok(out.includes(`export { default as Glyph } from ${at("Icon.mjs")}`), out)
    assert.ok(out.includes('export type { LucideProps } from "lucide-react-native"'), out)
    assert.ok(out.includes('export type { LucideIcon } from "lucide-react-native"'), out)
  })
})

test("only type-only and namespace imports stay on the barrel", () => {
  withFake((esmDir, at) => {
    const out = transform(
      [
        'import { type LucideProps, Check } from "lucide-react-native"',
        'import type { LucideIcon } from "lucide-react-native"',
        'import { type IconNode } from "lucide-react-native"',
        'import * as All from "lucide-react-native/icons"',
      ].join("\n"),
      esmDir,
    )
    assert.ok(out.includes('import type { LucideProps } from "lucide-react-native"'), out)
    assert.ok(out.includes(`import Check from ${at("icons/check.mjs")}`), out)
    assert.ok(out.includes('import type { LucideIcon } from "lucide-react-native"'), out)
    assert.ok(out.includes('import { type IconNode } from "lucide-react-native"'), out)
    assert.ok(out.includes('import * as All from "lucide-react-native/icons"'), out)
  })
})

test("any other value import that would land on a barrel fails the build", () => {
  withFake((esmDir) => {
    const cases: [string, RegExp][] = [
      [
        'import { LucideProps } from "lucide-react-native"',
        /"LucideProps" is not a value export of lucide-react-native/,
      ],
      [
        'import { Home } from "lucide-react-native/icons"',
        /"Home" is not a value export of lucide-react-native\/icons/,
      ],
      ['import { Icon } from "lucide-react-native/icons"', /"Icon" is not a value export/],
      ['import Lucide from "lucide-react-native"', /A default import of lucide-react-native would bundle every/],
      ['import "lucide-react-native/icons"', /A side-effect import of lucide-react-native\/icons would bundle every/],
      ['export * from "lucide-react-native"', /`export \*` from lucide-react-native would bundle every/],
      ['export { Nope } from "lucide-react-native/icons"', /"Nope" is not a value export/],
    ]
    for (const [code, message] of cases) assert.throws(() => transform(code, esmDir), message, code)
  })
})

test("a barrel the parser cannot fully read fails the build instead of silently bundling every icon", () => {
  const esmDir = mkdtempSync(join(tmpdir(), "lucide-odd-"))
  try {
    mkdirSync(join(esmDir, "icons"))
    writeFileSync(join(esmDir, "icons", "index.mjs"), "export { default as Check } from './check.mjs';\n")
    writeFileSync(join(esmDir, "lucide-react-native.mjs"), "\n")
    assert.throws(() => transform('import { Check } from "lucide-react-native"', esmDir), /no exports found/)
    writeFileSync(join(esmDir, "lucide-react-native.mjs"), "export * from './icons/index.mjs';\n")
    assert.throws(() => transform('import { Check } from "lucide-react-native"', esmDir), /unrecognized export/)
  } finally {
    rmSync(esmDir, { recursive: true })
  }
})

test("the installed barrels map every export to a module that exists, covering every icon file", () => {
  const iconFiles = readdirSync(join(installedEsmDir, "icons")).filter(
    (file) => file.endsWith(".mjs") && file !== "index.mjs",
  )
  for (const barrel of ["lucide-react-native.mjs", join("icons", "index.mjs")]) {
    const exports = lucideBarrelExports(join(installedEsmDir, barrel))
    const targets = new Set([...exports.values()].map(({ file }) => file))
    for (const file of targets) assert.ok(existsSync(file), file)
    for (const icon of iconFiles) assert.ok(targets.has(join(installedEsmDir, "icons", icon)), `${barrel}: ${icon}`)
  }
  const root: Map<string, unknown> = lucideBarrelExports(join(installedEsmDir, "lucide-react-native.mjs"))
  for (const name of ["Icon", "createLucideIcon", "LucideProvider", "useLucideContext", "Home", "House"]) {
    assert.ok(root.has(name), name)
  }
})

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const uiSrc = join(dirname(require.resolve("@civfix/ui/package.json")), "src")
const SKIP_DIRS = new Set(["node_modules", "ios", "android", "dist", "dist-types", ".expo", "tests"])
const LUCIDE_IMPORT = /\bfrom\s+["']lucide-react-native(?:\/icons)?["']|\bimport\s+["']lucide-react-native/

function lucideImportSites(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) lucideImportSites(path, found)
    } else if (/\.(?:[cm]?js|jsx|tsx?)$/.test(entry.name) && LUCIDE_IMPORT.test(readFileSync(path, "utf8"))) {
      found.push(path)
    }
  }
  return found
}

function moduleNodes(code: string, filename: string): ImportNode[] {
  return babel.parseSync(code, {
    babelrc: false,
    configFile: false,
    filename,
    parserOpts: { plugins: ["typescript", "jsx"] },
  }).program.body
}

test("every lucide import site in the app and @civfix/ui transforms to direct imports only", () => {
  const sites = [...lucideImportSites(uiSrc), ...lucideImportSites(mobileRoot)]
  assert.ok(
    sites.some((file) => file.endsWith(join("typography", "iconMap.ts"))),
    sites.join("\n"),
  )
  let valueSpecifiers = 0
  let directImports = 0
  for (const file of sites) {
    const input = moduleNodes(readFileSync(file, "utf8"), file)
    for (const node of input) {
      if (node.type !== "ImportDeclaration" || !BARRELS.has(node.source?.value ?? "")) continue
      if (node.importKind === "type") continue
      valueSpecifiers += (node.specifiers ?? []).filter((spec) => spec.importKind !== "type").length
    }
    const out = babel.transformSync(readFileSync(file, "utf8"), {
      babelrc: false,
      configFile: false,
      filename: file,
      plugins: [[lucideDirectImports, { esmDir: installedEsmDir }]],
      parserOpts: { plugins: ["typescript", "jsx"] },
    }).code
    for (const node of moduleNodes(out, file)) {
      const source = node.source?.value ?? ""
      if (BARRELS.has(source)) {
        const typeOnly = node.importKind === "type" || node.specifiers?.every((spec) => spec.importKind === "type")
        assert.ok(typeOnly, `${relative(mobileRoot, file)} still imports a value from ${source}`)
      } else if (node.type === "ImportDeclaration" && source.startsWith(installedEsmDir)) {
        assert.ok(existsSync(source), source)
        directImports += 1
      }
    }
  }
  assert.ok(valueSpecifiers > 6, `only ${valueSpecifiers} lucide imports found`)
  assert.equal(directImports, valueSpecifiers)
})
