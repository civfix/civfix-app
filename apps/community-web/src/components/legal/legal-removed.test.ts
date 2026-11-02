import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const appDir = fileURLToPath(new URL("../../..", import.meta.url))

describe("the hand-written legal pages", () => {
  it("T31: are gone, and the page shell stamps no version of its own", () => {
    expect(existsSync(join(appDir, "src/app/legal/legal-contact-link.tsx"))).toBe(false)
    expect(existsSync(join(appDir, "src/components/legal/legal-versions.test.ts"))).toBe(false)
    const page = readFileSync(join(appDir, "src/components/legal/legal-page.tsx"), "utf8")
    expect(page).not.toMatch(/from "@civfix\/contract\/legal"/)
    expect(page).not.toMatch(/data-legal-doc|data-legal-version/)
  })
})
