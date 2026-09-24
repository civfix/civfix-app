import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"

const require = createRequire(import.meta.url)
const { lucideDirectImports } = require("../babel.config.js")
const babel = require("@babel/core")

function fakeLucide(): string {
  const esmDir = mkdtempSync(join(tmpdir(), "lucide-esm-"))
  mkdirSync(join(esmDir, "icons"))
  writeFileSync(
    join(esmDir, "lucide-react-native.mjs"),
    [
      "export { LucideProvider } from './context.mjs';",
      "export { default as Icon } from './Icon.mjs';",
      "export { default as Check, default as CheckIcon, default as LucideCheck } from './icons/check.mjs';",
      "export { default as House, default as Home, default as HouseIcon } from './icons/house.mjs';",
    ].join("\n"),
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

test("icon imports from either barrel become per-icon default imports", () => {
  const esmDir = fakeLucide()
  try {
    const out = transform(
      'import { Check, House as HomeIcon } from "lucide-react-native/icons"\nimport { Home } from "lucide-react-native"',
      esmDir,
    )
    assert.ok(out.includes(`import Check from ${JSON.stringify(join(esmDir, "icons", "check.mjs"))}`))
    assert.ok(out.includes(`import HomeIcon from ${JSON.stringify(join(esmDir, "icons", "house.mjs"))}`))
    assert.ok(out.includes(`import Home from ${JSON.stringify(join(esmDir, "icons", "house.mjs"))}`))
    assert.ok(!out.includes('"lucide-react-native'), out)
  } finally {
    rmSync(esmDir, { recursive: true })
  }
})

test("non-icon, type-only and namespace imports stay on the original source", () => {
  const esmDir = fakeLucide()
  try {
    const out = transform(
      [
        'import { Icon, LucideProvider, Check } from "lucide-react-native"',
        'import type { LucideProps } from "lucide-react-native"',
        'import { type LucideIcon } from "lucide-react-native"',
        'import * as All from "lucide-react-native/icons"',
      ].join("\n"),
      esmDir,
    )
    assert.ok(out.includes('import { Icon, LucideProvider } from "lucide-react-native"'), out)
    assert.ok(out.includes(`import Check from ${JSON.stringify(join(esmDir, "icons", "check.mjs"))}`))
    assert.ok(out.includes('import type { LucideProps } from "lucide-react-native"'), out)
    assert.ok(out.includes('import { type LucideIcon } from "lucide-react-native"'), out)
    assert.ok(out.includes('import * as All from "lucide-react-native/icons"'), out)
  } finally {
    rmSync(esmDir, { recursive: true })
  }
})

test("an unreadable barrel fails the build instead of silently bundling every icon", () => {
  const esmDir = mkdtempSync(join(tmpdir(), "lucide-empty-"))
  try {
    writeFileSync(join(esmDir, "lucide-react-native.mjs"), "export {};\n")
    assert.throws(() => transform('import { Check } from "lucide-react-native"', esmDir), /no icon exports/)
  } finally {
    rmSync(esmDir, { recursive: true })
  }
})

test("the installed lucide-react-native resolves every icon the app imports", () => {
  const out = transform(
    'import { Check, House, ChartColumn, CircleCheckBig, BadgeCheck, Apple } from "lucide-react-native/icons"',
    join(require.resolve("lucide-react-native"), "..", "..", "esm"),
  )
  assert.equal((out.match(/\/icons\/[a-z0-9-]+\.mjs"/g) ?? []).length, 6, out)
})
