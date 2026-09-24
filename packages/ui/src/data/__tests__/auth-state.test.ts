/**
 * `normalizeAuthState` is the single rule that maps a host's raw "authed" signals onto the data seam's
 * "authenticated" state. The fake DataContext is checked too, because bodies and the gallery rely on its
 * `useAuthState` returning exactly the configured AuthState.
 */
import { describe, expect, it } from "vitest"
import type { UserDTO } from "@civfix/shared"
import { normalizeAuthState } from "../types"
import { makeFakeDataContext } from "../fakes"

/** A minimal stand-in user (only identity matters for these assertions). */
const USER = { id: "u1" } as unknown as UserDTO

describe("normalizeAuthState (authed vs authenticated)", () => {
  it("confirmed signed-in (authed + user, not pending) -> isAuthenticated", () => {
    expect(normalizeAuthState({ authed: true, pending: false, user: USER })).toEqual({
      isAuthenticated: true,
      user: USER,
      isPending: false,
    })
  })

  it("signed-out (not authed, not pending, no user) -> not authenticated", () => {
    expect(normalizeAuthState({ authed: false, pending: false, user: null })).toEqual({
      isAuthenticated: false,
      user: null,
      isPending: false,
    })
  })

  it("still resolving (pending) -> isPending, never authenticated even if authed/user leak in", () => {
    // Pending wins: a transient state must not flash a confirmed signed-in answer.
    expect(normalizeAuthState({ authed: false, pending: true, user: null })).toEqual({
      isAuthenticated: false,
      user: null,
      isPending: true,
    })
    expect(normalizeAuthState({ authed: true, pending: true, user: USER })).toEqual({
      isAuthenticated: false,
      user: USER,
      isPending: true,
    })
  })

  it("optimistic-authed (authed + cached user, not pending) -> isAuthenticated (paints signed-in)", () => {
    // Both hosts render an optimistic authed state from a cached user; it normalizes to signed-in.
    expect(normalizeAuthState({ authed: true, pending: false, user: USER }).isAuthenticated).toBe(true)
  })

  it("degenerate authed-with-null-user -> NOT authenticated (never surface signed-in without a user)", () => {
    expect(normalizeAuthState({ authed: true, pending: false, user: null })).toEqual({
      isAuthenticated: false,
      user: null,
      isPending: false,
    })
  })
})

describe("makeFakeDataContext().useAuthState", () => {
  it("defaults to signed out", () => {
    const ctx = makeFakeDataContext()
    expect(ctx.useAuthState()).toEqual({ isAuthenticated: false, user: null, isPending: false })
  })

  it("returns the configured auth shape (override merged over the signed-out default)", () => {
    const ctx = makeFakeDataContext({ auth: { isAuthenticated: true, user: USER } })
    expect(ctx.useAuthState()).toEqual({ isAuthenticated: true, user: USER, isPending: false })
  })

  it("can represent the pending shape", () => {
    const ctx = makeFakeDataContext({ auth: { isPending: true } })
    expect(ctx.useAuthState()).toEqual({ isAuthenticated: false, user: null, isPending: true })
  })
})
