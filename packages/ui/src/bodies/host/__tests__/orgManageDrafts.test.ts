import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const body = code(readFileSync(new URL("../OrgManageBody.tsx", import.meta.url), "utf8"))

describe("the org manage drafts", () => {
  it("seed once per org rather than on every new org object", () => {
    expect(body).toContain("if (orgId !== seededOrgId) {")
    expect(body).not.toContain("useEffect(() => setLinks(initialLinks), [initialLinks])")
    expect(body).not.toContain("}, [initialProfile])")
  })

  it("reset only the section that was saved, from the saved organization", () => {
    const profileSave = body.slice(body.indexOf("save.mutate(profilePayload("), body.indexOf("const saveLinks"))
    expect(profileSave).toContain("setProfile(profileDraftFrom(updated))")
    expect(profileSave).not.toContain("setLinks(")
    const linksSave = body.slice(body.indexOf("save.mutate(linksPayload("), body.indexOf("const pickLogo"))
    expect(linksSave).toContain("setLinks(linksDraftFrom(updated))")
    expect(linksSave).not.toContain("setProfile(")
  })

  it("drops an unsaved logo preview when the profile edits are discarded", () => {
    expect(body).toMatch(/setProfile\(initialProfile\)\n\s+setLogoPreview\(null\)\n\s+\}\}/)
  })
})
