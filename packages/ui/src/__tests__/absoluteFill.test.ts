import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

// React Native 0.85 (Expo SDK 56) removed the Object variant; StyleSheet.absoluteFill gives the same layout (D6).
// The needle is split so this file does not match itself.
const REPO = fileURLToPath(new URL("../../../../", import.meta.url))
const REMOVED = ["absoluteFill", "Object"].join("")

describe("T5: StyleSheet.absoluteFill replaces the removed Object variant", () => {
  it("leaves no use of it in any tracked file under apps/ or packages/", () => {
    const grep = spawnSync("git", ["grep", "-n", REMOVED, "--", "apps", "packages"], {
      cwd: REPO,
      encoding: "utf8",
    })
    // git grep exits 1 when nothing matches and 2 or more when it could not search.
    expect(grep.stdout).toBe("")
    expect(grep.status, grep.stderr).toBe(1)
  })
})
