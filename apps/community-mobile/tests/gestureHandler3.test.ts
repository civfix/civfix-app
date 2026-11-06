import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const APP = fileURLToPath(new URL("..", import.meta.url).href)

// Gesture Handler 3 deprecates the builder and the old buttons, and lint fails on deprecated APIs (D6).
const BUILDER =
  /\bGesture\.(Pan|Pinch|Tap|Native|Race|Simultaneous|Exclusive|Fling|LongPress|Rotation|Hover|Manual|ForceTouch)\(/g
const OLD_BUTTON_IMPORT =
  /import\s*(?:type\s*)?\{[^}]*\b(RawButton|BaseButton|RectButton|BorderlessButton)\b[^}]*\}\s*from\s*"react-native-gesture-handler"/g

function sources(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .filter((name) => !name.split(/[\\/]/).includes("node_modules"))
    .map((name) => join(dir, name))
}

test("T10: no app or src file uses the Gesture builder or an old gesture-handler button", () => {
  const files = [...sources(join(APP, "app")), ...sources(join(APP, "src"))]
  assert.ok(files.length > 0)
  const builder: string[] = []
  const buttons: string[] = []
  for (const file of files) {
    const text = readFileSync(file, "utf8")
    for (const match of text.matchAll(BUILDER)) builder.push(`${file}: ${match[0]}`)
    for (const match of text.matchAll(OLD_BUTTON_IMPORT)) buttons.push(`${file}: ${match[1] ?? ""}`)
  }
  assert.deepEqual(builder, [])
  assert.deepEqual(buttons, [])
})

test("T20: the not-found tiles throw through one manually activated usePanGesture", () => {
  const src = readFileSync(join(APP, "src/components/notFound/TilesStage.tsx"), "utf8")
  const start = src.indexOf("const throwing = usePanGesture({")
  assert.ok(start > -1, "const throwing = usePanGesture({ is gone")
  assert.equal(src.split("usePanGesture(").length - 1, 1)
  const end = src.indexOf("\n  })\n", start)
  assert.ok(end > start)
  const config = src.slice(start, end)

  assert.match(config, /manualActivation: true,/)
  assert.match(config, /onTouchesDown: \(event\) => \{/)
  assert.match(config, /onUpdate: \(event\) => \{/)
  assert.match(config, /onFinalize: \(\) => \{/)

  const touchesDown = config.slice(config.indexOf("onTouchesDown:"), config.indexOf("onUpdate:"))
  assert.match(
    touchesDown,
    /if \(!touch \|\| hit < 0\) \{[\s\S]*?GestureStateManager\.fail\(event\.handlerTag\)\s*return\s*\}/,
  )
  assert.match(touchesDown, /wake\(\)\s*GestureStateManager\.activate\(event\.handlerTag\)\s*\}/)
  assert.doesNotMatch(config, /manager\./)
  assert.match(src, /<GestureDetector gesture=\{throwing\}>/)
})
