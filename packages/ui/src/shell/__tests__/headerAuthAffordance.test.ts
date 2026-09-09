/**
 * Unit test for the portrait/compact SearchHeader's profile-vs-sign-in affordance gate. Signed out, the
 * header shows a sign-in icon (tapping it opens auth directly) INSTEAD of the "You" avatar that used to
 * open an empty profile. While the session is still resolving (pending) we keep the avatar so a logged-in
 * viewer reloading never sees the sign-in icon flash before their session confirms.
 *
 * The gate is a pure predicate over the shared AuthState, so vitest exercises it directly (no renderer).
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
