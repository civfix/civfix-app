import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const AVATAR = readFileSync(new URL("../Avatar.tsx", import.meta.url), "utf8")

describe("Avatar photo loading (issue #94)", () => {
  it("passes a STABLE onError, because the RNW Image loader effect lists it in its deps", () => {
    expect(AVATAR).toContain(
      "const onPhotoError = useCallback(() => setFailedUrl(photoUrl ?? null), [photoUrl])",
    )
    expect(AVATAR).toContain("onError={onPhotoError}")
  })

  it("hands the Image no per-render handler identity at all", () => {
    expect(AVATAR).not.toMatch(/on(Error|Load|LoadStart|LoadEnd)=\{\(/)
  })

  it("memoizes the source object on the url it resolves from", () => {
    expect(AVATAR).toContain('const photoSource = useMemo(() => ({ uri: photoUrl as string }), [photoUrl])')
    expect(AVATAR).toContain("source={photoSource}")
  })

  it("imports useCallback from react", () => {
    expect(AVATAR).toMatch(/^import React, \{[^}]*\buseCallback\b[^}]*\} from "react"/m)
  })
})
