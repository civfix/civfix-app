import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

test("the bundle entry defines the clear task before expo-router, so a headless start has it", () => {
  const manifest = JSON.parse(read("../package.json")) as { main: string }
  assert.equal(manifest.main, "index.ts")
  const imports = [...read("../index.ts").matchAll(/^import "([^"]+)"$/gm)].map((m) => m[1])
  assert.deepEqual(imports, ["./src/push/clearTask", "expo-router/entry"])
})
