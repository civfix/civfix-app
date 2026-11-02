import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const read = (...path: string[]) => readFileSync(join(__dirname, "..", "..", ...path), "utf8")

describe("the web app's legal update wiring", () => {
  it("T32: the first-run gate submits through the shared sign-up acceptance step", () => {
    const gate = read("features", "auth", "first-run-gate.tsx")
    expect(gate).toMatch(/const complete = useCompleteFirstRun\(\)/)
    expect(gate).toMatch(/complete\.mutate\(\{ handle: trimmedHandle, displayName \}\)/)
    expect(gate).not.toMatch(/useUpdateProfile|updateProfile\(/)
  })

  it("T33: the legal update gate renders right after the first-run gate", () => {
    const providers = read("components", "providers.tsx")
    expect(providers).toMatch(/<FirstRunGate \/>\n\s*<LegalUpdateGate \/>/)
  })
})
