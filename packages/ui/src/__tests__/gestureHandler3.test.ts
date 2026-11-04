import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Gesture Handler 3 deprecates the builder and the old buttons, and lint fails on deprecated APIs (D6).
const SRC = join(__dirname, "..")
const BUILDER =
  /\bGesture\.(Pan|Pinch|Tap|Native|Race|Simultaneous|Exclusive|Fling|LongPress|Rotation|Hover|Manual|ForceTouch)\(/g
const OLD_BUTTON_IMPORT =
  /import\s*(?:type\s*)?\{[^}]*\b(RawButton|BaseButton|RectButton|BorderlessButton)\b[^}]*\}\s*from\s*"react-native-gesture-handler"/g

function sources(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .filter((name) => !name.split(/[\\/]/).includes("__tests__"))
    .map((name) => join(SRC, name))
}

describe("T9: packages/ui is on Gesture Handler 3's hook API", () => {
  const files = sources()

  it("uses the Gesture builder nowhere", () => {
    expect(files.length).toBeGreaterThan(0)
    const hits = files.flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(BUILDER)].map((m) => `${file}: ${m[0]}`),
    )
    expect(hits).toEqual([])
  })

  it("imports none of the deprecated gesture-handler buttons", () => {
    const hits = files.flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(OLD_BUTTON_IMPORT)].map(
        (m) => `${file}: ${m[1] ?? ""}`,
      ),
    )
    expect(hits).toEqual([])
  })
})
