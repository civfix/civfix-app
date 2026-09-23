import assert from "node:assert/strict"
import { globSync, readdirSync, readFileSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const appDir = fileURLToPath(new URL("../", import.meta.url))
const pkg = JSON.parse(readFileSync(join(appDir, "package.json"), "utf8"))
const testScript: string = pkg.scripts.test

// Gitignored or generated trees never hold tracked tests; ios/ and android/ are prebuild output.
const UNTRACKED_DIRS = new Set(["node_modules", "ios", "android", "build", "dist", "out", "coverage", "web-build"])
const TEST_FILE = /\.test\.tsx?$/

function testFilesUnder(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".") || UNTRACKED_DIRS.has(entry.name)) continue
      found.push(...testFilesUnder(join(dir, entry.name)))
    } else if (TEST_FILE.test(entry.name)) {
      found.push(relative(appDir, join(dir, entry.name)).split(sep).join("/"))
    }
  }
  return found
}

function scriptGlobs(): string[] {
  return [...testScript.matchAll(/'([^']+)'/g)].map((match) => match[1])
}

test("the test script hands Node quoted globs, so the shell cannot flatten **", () => {
  const globs = scriptGlobs()
  assert.ok(globs.length > 0, `no quoted glob in the test script: ${testScript}`)
  for (const glob of globs) assert.match(glob, /\*\*\//, `${glob} does not recurse`)
})

test("every test file in the app is run by the test script", () => {
  const matched = new Set(
    globSync(scriptGlobs(), { cwd: appDir }).map((file) => file.split(sep).join("/")),
  )
  const onDisk = testFilesUnder(appDir)
  assert.ok(onDisk.includes("tests/testGlobCoverage.test.ts"), "the file walk missed this very test")

  const missed = onDisk.filter((file) => !matched.has(file))
  assert.deepEqual(missed, [], "these test files never run under `pnpm test`")
})
