import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"

const scriptsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts")

const EXPO_CONFIG = JSON.stringify({
  version: "1.0.0",
  extra: { apiUrl: "https://api.civfix.dev" },
  ios: { buildNumber: "1" },
  android: { versionCode: 1 },
})

const roots: string[] = []
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

type Platform = "ios" | "android"

interface Fixture {
  appDir: string
  run: (platform: Platform) => { status: number | null; output: string }
  prebuildLog: () => string[]
}

// A copy of prep-archive.sh in a throwaway checkout, with every tool it shells out to stubbed first on
// PATH. The npx stub's prebuild deletes and recreates the platform folder, as SDK 57's prebuild does.
function fixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "prep-archive-"))
  roots.push(root)
  const appDir = join(root, "apps", "community-mobile")
  mkdirSync(join(appDir, "scripts"), { recursive: true })
  copyFileSync(join(scriptsDir, "prep-archive.sh"), join(appDir, "scripts", "prep-archive.sh"))

  const bin = join(root, "bin")
  const scratch = join(root, "tmp")
  const log = join(root, "npx.log")
  mkdirSync(bin)
  mkdirSync(scratch)
  const stub = (name: string, body: string): void => {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`)
    chmodSync(join(bin, name), 0o755)
  }
  stub(
    "npx",
    [
      'if [ "$1" = expo ] && [ "$2" = prebuild ]; then',
      `  printf '%s\\n' "$*" >> '${log}'`,
      '  platform=""; prev=""',
      '  for arg in "$@"; do [ "$prev" = --platform ] && platform="$arg"; prev="$arg"; done',
      '  rm -rf "$platform" && mkdir "$platform" && : > "$platform/generated"',
      "  exit 0",
      "fi",
      'if [ "$1" = expo ] && [ "$2" = config ] && [ "$3" = --json ]; then',
      `  printf '%s\\n' '${EXPO_CONFIG}'`,
      "  exit 0",
      "fi",
      "exit 1",
    ].join("\n"),
  )
  for (const name of ["pnpm", "pod", "xcodebuild"]) stub(name, "exit 0")
  stub("pgrep", "exit 1")

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${bin}:${(process.env.PATH as string | undefined) ?? ""}`,
    CIVFIX_APPLE_TEAM_ID: "TEAMID0000",
    TMPDIR: scratch,
  }
  delete env.CIVFIX_APP_VARIANT

  return {
    appDir,
    run(platform) {
      const args = [join(appDir, "scripts", "prep-archive.sh"), "testflight"]
      if (platform === "android") args.push("--platform", "android")
      const result = spawnSync("bash", args, { cwd: root, env, encoding: "utf8" })
      return { status: result.status, output: `${result.stdout}${result.stderr}` }
    },
    prebuildLog() {
      if (!existsSync(log)) return []
      return readFileSync(log, "utf8")
        .split("\n")
        .filter((line) => line.includes("prebuild"))
    },
  }
}

function withXcodeEnvLocal(): Fixture {
  const f = fixture()
  mkdirSync(join(f.appDir, "ios"))
  writeFileSync(
    join(f.appDir, "ios", ".xcode.env.local"),
    "export NODE_BINARY=/opt/node/bin/node\n",
  )
  return f
}

function withLocalProperties(): Fixture {
  const f = fixture()
  mkdirSync(join(f.appDir, "android"))
  writeFileSync(join(f.appDir, "android", "local.properties"), "sdk.dir=/opt/android-sdk\n")
  return f
}

test("T1: ios/.xcode.env.local survives a prebuild that recreates ios/", () => {
  const f = withXcodeEnvLocal()
  const { status, output } = f.run("ios")
  assert.equal(status, 0, output)
  assert.ok(existsSync(join(f.appDir, "ios", "generated")), "ios/ was not recreated")
  assert.equal(
    readFileSync(join(f.appDir, "ios", ".xcode.env.local"), "utf8"),
    "export NODE_BINARY=/opt/node/bin/node\n",
  )
})

test("T2: android/local.properties survives a prebuild that recreates android/", () => {
  const f = withLocalProperties()
  const { status, output } = f.run("android")
  assert.equal(status, 0, output)
  assert.ok(existsSync(join(f.appDir, "android", "generated")), "android/ was not recreated")
  assert.equal(
    readFileSync(join(f.appDir, "android", "local.properties"), "utf8"),
    "sdk.dir=/opt/android-sdk\n",
  )
})

test("T3: with no ios/ folder, no .xcode.env.local is invented", () => {
  const f = fixture()
  const { status, output } = f.run("ios")
  assert.equal(status, 0, output)
  assert.ok(existsSync(join(f.appDir, "ios", "generated")), "ios/ was not created")
  assert.equal(existsSync(join(f.appDir, "ios", ".xcode.env.local")), false)
})

test("T4: with no android/ folder, no local.properties is invented", () => {
  const f = fixture()
  const { status, output } = f.run("android")
  assert.equal(status, 0, output)
  assert.ok(existsSync(join(f.appDir, "android", "generated")), "android/ was not created")
  assert.equal(existsSync(join(f.appDir, "android", "local.properties")), false)
})

test("T5: each platform prebuilds once, without --clean or --no-clean", () => {
  const ios = withXcodeEnvLocal()
  assert.equal(ios.run("ios").status, 0)
  assert.deepEqual(ios.prebuildLog(), ["expo prebuild --platform ios --no-install"])

  const android = withLocalProperties()
  assert.equal(android.run("android").status, 0)
  assert.deepEqual(android.prebuildLog(), ["expo prebuild --platform android --no-install"])
})

test("T6: android-build.sh prebuilds once, without --clean or --no-clean", () => {
  const source = readFileSync(join(scriptsDir, "android-build.sh"), "utf8")
  const prebuilds = source
    .split("\n")
    .filter((line) => line.trim() === "npx expo prebuild --platform android --no-install")
  assert.equal(prebuilds.length, 1)
  assert.doesNotMatch(source, /--clean/)
  assert.doesNotMatch(source, /--no-clean/)
})
