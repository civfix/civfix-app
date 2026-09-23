import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

const FILES = [
  "../app/_layout.tsx",
  "../src/lib/nativeGeolocation.ts",
  "../src/lib/nativeCamera.ts",
  "../src/lib/nativeCalendarFile.ts",
  "../src/lib/lastCenter.ts",
  "../src/lib/nativeHaptics.ts",
  "../src/components/report/ReportViewfinder.tsx",
] as const

test("no error is swallowed without a stated reason", () => {
  for (const file of FILES) {
    const source = read(file)
    assert.doesNotMatch(source, /catch\s*(\([^)]*\))?\s*\{\s*\}/, `${file} has an empty catch block`)
    assert.doesNotMatch(source, /\.catch\(\(\) => \{\}\)/, `${file} has an anonymous no-op .catch`)
    assert.doesNotMatch(source, /\.catch\(\(\) => false\)/, `${file} discards a failure as false`)
  }
})

test("a failed storage purge at boot is logged by name before the app hydrates anyway", () => {
  const layout = read("../app/_layout.tsx")
  const boot = layout.slice(layout.indexOf("function useBootstrap()"))
  assert.match(
    boot.slice(0, boot.indexOf("\n}\n")),
    /\.catch\(\(err: unknown\) => \{\s*console\.warn\("\[storage-env\][^"]*", errorName\(err\)\)\s*\}\)\s*\.finally\(\(\) => \{\s*void hydrate\(\)/,
  )
})

test("an unreadable cold-start notification tap is logged instead of silently dropped", () => {
  const layout = read("../app/_layout.tsx")
  const hook = layout.slice(layout.indexOf("function useNotificationDeepLinks()"))
  assert.match(
    hook.slice(0, hook.indexOf("\n}\n")),
    /Notifications\.clearLastNotificationResponse\(\)\s*\} catch \(err\) \{\s*console\.warn\("\[push\][^"]*", errorName\(err\)\)/,
  )
})

test("log lines carry only the error's name, never its message", () => {
  const layout = read("../app/_layout.tsx")
  const helper = layout.slice(layout.indexOf("function errorName("))
  assert.match(helper.slice(0, helper.indexOf("\n}\n")), /return err instanceof Error \? err\.name : typeof err/)
})
