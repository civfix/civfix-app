import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { authorAsSelection } from "../authorAsModel"

describe("authorAsSelection guards a stored organization against a stale membership", () => {
  const orgs = [{ id: "org_1" }, { id: "org_2" }]

  it("keeps a stored id that is still one of the viewer's organizations", () => {
    expect(authorAsSelection("org_2", orgs)).toBe("org_2")
  })

  it("falls back to personal once the viewer has left that organization", () => {
    expect(authorAsSelection("org_9", orgs)).toBeNull()
    expect(authorAsSelection("org_1", [])).toBeNull()
  })

  it("holds the stored id while the membership list is still loading", () => {
    expect(authorAsSelection("org_1", undefined)).toBe("org_1")
  })

  it("reads null as personal", () => {
    expect(authorAsSelection(null, orgs)).toBeNull()
  })
})

describe("the author pickers are wired to the stored selection", () => {
  const composer = readFileSync(new URL("../PostComposer.tsx", import.meta.url), "utf8")
  const form = readFileSync(new URL("../CleanupForm.tsx", import.meta.url), "utf8")

  it("the post composer sends the guarded selection, not the raw draft field", () => {
    expect(composer).toContain("authorAsSelection(draft.organizationId, myOrgs.data)")
    expect(composer).toContain("organizationId: postAsOrganizationId,")
  })

  it("the post composer clears a selection the viewer can no longer post as", () => {
    expect(composer).toContain(
      "if (draft.organizationId !== null && postAsOrganizationId === null) setOrganizationId(null)",
    )
  })

  it("the event form offers the picker only where a host identity can still be chosen", () => {
    expect(form).toContain("<AuthorAsChips")
    expect(form).toContain('tCreate("host_as.label")')
  })
})
