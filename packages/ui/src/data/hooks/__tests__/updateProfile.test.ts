/**
 * Settings saves `await updateProfile.mutateAsync(...)`, closes the editor on the row, and builds the NEXT
 * save's payload from `useMyProfile()` (`displayName: profile.name`). If the mutation resolves before the
 * profile refetch lands, the row repaints the old value and a quick second save sends the stale name
 * back to the server. The hook is not renderable in this node-only package, so the settle order is
 * pinned at the source.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const SRC = readFileSync(join(__dirname, "..", "social.ts"), "utf8")

describe("useUpdateProfile", () => {
  it("resolves mutateAsync only after the viewer's own profile has refetched", () => {
    const start = SRC.indexOf("export function useUpdateProfile")
    const fn = SRC.slice(start, SRC.indexOf("export function useHandleAvailability", start))
    expect(fn).toContain("return qc.invalidateQueries({ queryKey: queryKeys.myProfile })")
    expect(fn).not.toContain("void qc.invalidateQueries({ queryKey: queryKeys.myProfile })")
  })
})
