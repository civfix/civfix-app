/**
 * The shared link builders default to the production origin, so without this call civfix.dev would build
 * https://civfix.org links and treat its own links as external. The provider module cannot load under
 * vitest (react-native flow sources), so the guard reads the exact module-scope call.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const providers = readFileSync(new URL("./providers.tsx", import.meta.url), "utf8")

describe("web providers", () => {
  it("points the shared link builders at the origin the app is served from", () => {
    expect(providers).toContain('if (typeof window !== "undefined") setWebOrigin(window.location.origin)')
    expect(providers).toMatch(/import \{[^}]*\bsetWebOrigin\b[^}]*\} from "@civfix\/ui"/)
  })
})
