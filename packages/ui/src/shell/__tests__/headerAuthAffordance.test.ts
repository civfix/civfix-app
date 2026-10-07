/**
 * Signed out shows a sign-in icon; while the session is still resolving the avatar stays, so a signed-in
 * viewer reloading never sees the sign-in icon flash.
 */
import { describe, expect, it } from "vitest"
import { headerAuthAffordance } from "../headerAuthAffordance"

describe("headerAuthAffordance", () => {
  it("shows the profile avatar for a confirmed signed-in viewer", () => {
    expect(headerAuthAffordance({ isAuthenticated: true, isPending: false })).toBe("profile")
  })

  it("shows the sign-in icon when signed out (terminal: not authed, not pending)", () => {
    expect(headerAuthAffordance({ isAuthenticated: false, isPending: false })).toBe("sign-in")
  })

  it("keeps the avatar while the session is still resolving (no sign-in flash)", () => {
    expect(headerAuthAffordance({ isAuthenticated: false, isPending: true })).toBe("profile")
  })
})
