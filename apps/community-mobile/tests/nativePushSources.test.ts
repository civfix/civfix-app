import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const APP = fileURLToPath(new URL("..", import.meta.url).href)

function sources(dir: string): string[] {
  return readdirSync(join(APP, dir), { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .map((file) => join(dir, file))
}

function read(file: string): string {
  return readFileSync(join(APP, file), "utf8")
}

function resolveAppImport(specifier: string): string | null {
  const base = specifier.startsWith("@/") ? join("src", specifier.slice(2)) : null
  if (!base) return null
  for (const candidate of [`${base}.ts`, `${base}.tsx`]) {
    if (existsSync(join(APP, candidate))) return candidate
  }
  return null
}

test("T34: native tokens only, no settings consulted, the clear task defined where the layout loads it", () => {
  for (const file of [...sources("src"), ...sources("app")]) {
    assert.equal(read(file).includes("getExpoPushTokenAsync"), false, file)
  }
  for (const file of [...sources("src/push"), "src/lib/pushTokenSync.ts"]) {
    assert.doesNotMatch(read(file), /getNotificationPrefs|getNotificationSettings/, file)
  }
  assert.equal(existsSync(join(APP, "src/lib/pushRegistrationRetry.ts")), false)

  const manifest = JSON.parse(read("package.json")) as { dependencies: Record<string, string> }
  assert.ok(manifest.dependencies["expo-task-manager"], "expo-task-manager is not a dependency")

  const imported = [...read("app/_layout.tsx").matchAll(/^import [^"]*"([^"]+)"/gm)]
    .map((match) => resolveAppImport(match[1] ?? ""))
    .filter((file): file is string => file !== null)
  const taskModules = imported.filter((file) => {
    // Prettier puts only module-scope statements at column 0.
    const source = read(file)
    return (
      /^TaskManager\.defineTask/m.test(source) &&
      /^(?:void )?Notifications\.registerTaskAsync\(/m.test(source)
    )
  })
  assert.equal(
    taskModules.length,
    1,
    `modules the layout imports that define the task: ${taskModules.join(", ")}`,
  )
})
