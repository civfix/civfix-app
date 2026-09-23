import { beforeEach, describe, expect, it } from "vitest"

import {
  TEAM_INVITE_STASH_KEY,
  TEAM_INVITE_STASH_TTL_MS,
  parseStashedTeamInvite,
  clearStashedTeamInvite,
  readStashedTeamInvite,
  stashTeamInvite,
  stripTeamInviteFromUrl,
  takeTeamInviteFromUrl,
  teamInviteFromUrl,
} from "./team-invite"

const CLEANUP_ID = "22222222-2222-4222-8222-222222222222"
const TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789ABCD"

const NEXT_ROUTER_STATE = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ["", {}] }

function url(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function at(path: string): void {
  window.history.replaceState(null, "", path)
}

beforeEach(() => {
  window.sessionStorage.clear()
  at("/")
})

describe("teamInviteFromUrl", () => {
  it("reads the token out of the fragment", () => {
    expect(teamInviteFromUrl(`/cleanups/${CLEANUP_ID}`, `#teamInvite=${TOKEN}`)).toEqual({
      cleanupId: CLEANUP_ID,
      token: TOKEN,
    })
    expect(teamInviteFromUrl(`/cleanups/${CLEANUP_ID}/`, `#teamInvite=${TOKEN}`)).toEqual({
      cleanupId: CLEANUP_ID,
      token: TOKEN,
    })
  })

  it("ignores a token on any other path, and a path with no token", () => {
    expect(teamInviteFromUrl("/pin/abc", `#teamInvite=${TOKEN}`)).toBeNull()
    expect(teamInviteFromUrl(`/cleanups/${CLEANUP_ID}`, "#top")).toBeNull()
    expect(teamInviteFromUrl("/cleanups/_", `#teamInvite=${TOKEN}`)).toBeNull()
  })

  it("treats a blank token as absent", () => {
    expect(teamInviteFromUrl(`/cleanups/${CLEANUP_ID}`, "#teamInvite=%20")).toBeNull()
  })
})

describe("stripTeamInviteFromUrl", () => {
  it("scrubs the fragment form out of the address bar", () => {
    at(`/cleanups/${CLEANUP_ID}#teamInvite=${TOKEN}`)
    stripTeamInviteFromUrl()
    expect(url()).toBe(`/cleanups/${CLEANUP_ID}`)
  })

  it("scrubs a stray legacy query token out of the address bar", () => {
    at(`/cleanups/${CLEANUP_ID}?teamInvite=${TOKEN}`)
    stripTeamInviteFromUrl()
    expect(url()).toBe(`/cleanups/${CLEANUP_ID}`)
  })

  it("keeps the other params it finds beside the token", () => {
    at(`/cleanups/${CLEANUP_ID}?from=email&teamInvite=${TOKEN}`)
    stripTeamInviteFromUrl()
    expect(url()).toBe(`/cleanups/${CLEANUP_ID}?from=email`)
  })

  it("leaves a URL with no token exactly as it was", () => {
    at(`/cleanups/${CLEANUP_ID}?from=email#top`)
    stripTeamInviteFromUrl()
    expect(url()).toBe(`/cleanups/${CLEANUP_ID}?from=email#top`)
  })

  it("hands Next an unmarked entry so its router adopts the scrubbed URL", () => {
    window.history.replaceState(NEXT_ROUTER_STATE, "", `/cleanups/${CLEANUP_ID}#teamInvite=${TOKEN}`)
    stripTeamInviteFromUrl()
    expect(url()).toBe(`/cleanups/${CLEANUP_ID}`)
    expect((window.history.state as { __NA?: unknown } | null)?.__NA).toBeUndefined()
  })

  it("replaces rather than pushes, so Back never lands on the token again", () => {
    at("/")
    at(`/cleanups/${CLEANUP_ID}#teamInvite=${TOKEN}`)
    const before = window.history.length
    stripTeamInviteFromUrl()
    expect(window.history.length).toBe(before)
  })
})

describe("takeTeamInviteFromUrl", () => {
  it("returns the fragment token and scrubs it in the same call", () => {
    at(`/cleanups/${CLEANUP_ID}#teamInvite=${TOKEN}`)
    expect(takeTeamInviteFromUrl()).toEqual({ cleanupId: CLEANUP_ID, token: TOKEN })
    expect(url()).toBe(`/cleanups/${CLEANUP_ID}`)
  })

  it("scrubs a legacy query token without ever redeeming it", () => {
    at(`/cleanups/${CLEANUP_ID}?teamInvite=${TOKEN}`)
    expect(takeTeamInviteFromUrl()).toBeNull()
    expect(url()).toBe(`/cleanups/${CLEANUP_ID}`)
  })

  it("takes the fragment token and drops a query one riding alongside it", () => {
    at(`/cleanups/${CLEANUP_ID}?teamInvite=query-token-value-0000000&from=email#teamInvite=${TOKEN}`)
    expect(takeTeamInviteFromUrl()).toEqual({ cleanupId: CLEANUP_ID, token: TOKEN })
    expect(url()).toBe(`/cleanups/${CLEANUP_ID}?from=email`)
  })

  it("is null on a clean event URL and leaves it alone", () => {
    at(`/cleanups/${CLEANUP_ID}`)
    expect(takeTeamInviteFromUrl()).toBeNull()
    expect(url()).toBe(`/cleanups/${CLEANUP_ID}`)
  })
})

describe("the sign-in stash", () => {
  it("round-trips the link and clears on demand", () => {
    stashTeamInvite({ cleanupId: CLEANUP_ID, token: TOKEN })
    expect(readStashedTeamInvite()).toEqual({ cleanupId: CLEANUP_ID, token: TOKEN })
    clearStashedTeamInvite()
    expect(readStashedTeamInvite()).toBeNull()
  })

  it("rejects a stash somebody else wrote", () => {
    window.sessionStorage.setItem(TEAM_INVITE_STASH_KEY, "not json")
    expect(readStashedTeamInvite()).toBeNull()
    window.sessionStorage.setItem(TEAM_INVITE_STASH_KEY, JSON.stringify({ cleanupId: CLEANUP_ID }))
    expect(readStashedTeamInvite()).toBeNull()
  })
})

describe("the stash expires long before the invite does", () => {
  it("stamps every stash with the moment it was written", () => {
    stashTeamInvite({ cleanupId: CLEANUP_ID, token: TOKEN })
    const raw = window.sessionStorage.getItem(TEAM_INVITE_STASH_KEY) ?? ""
    expect(typeof (JSON.parse(raw) as { stashedAt?: unknown }).stashedAt).toBe("number")
  })

  it("is well inside the 14-day invite lifetime", () => {
    expect(TEAM_INVITE_STASH_TTL_MS).toBeLessThan(14 * 24 * 60 * 60_000)
  })

  it("drops a stash older than the TTL, and drops it from storage too", () => {
    const stale = JSON.stringify({
      cleanupId: CLEANUP_ID,
      token: TOKEN,
      stashedAt: Date.now() - TEAM_INVITE_STASH_TTL_MS - 1,
    })
    window.sessionStorage.setItem(TEAM_INVITE_STASH_KEY, stale)
    expect(readStashedTeamInvite()).toBeNull()
    expect(window.sessionStorage.getItem(TEAM_INVITE_STASH_KEY)).toBeNull()
  })

  it("keeps a stash written inside the TTL", () => {
    const fresh = JSON.stringify({
      cleanupId: CLEANUP_ID,
      token: TOKEN,
      stashedAt: Date.now() - (TEAM_INVITE_STASH_TTL_MS - 1_000),
    })
    window.sessionStorage.setItem(TEAM_INVITE_STASH_KEY, fresh)
    expect(readStashedTeamInvite()).toEqual({ cleanupId: CLEANUP_ID, token: TOKEN })
  })

  it("rejects an unstamped or future-dated stash rather than trusting it forever", () => {
    const at0 = 1_000_000
    expect(
      parseStashedTeamInvite(JSON.stringify({ cleanupId: CLEANUP_ID, token: TOKEN }), at0),
    ).toBeNull()
    expect(
      parseStashedTeamInvite(
        JSON.stringify({ cleanupId: CLEANUP_ID, token: TOKEN, stashedAt: at0 + 1 }),
        at0,
      ),
    ).toBeNull()
    expect(
      parseStashedTeamInvite(
        JSON.stringify({ cleanupId: CLEANUP_ID, token: TOKEN, stashedAt: at0 }),
        at0,
      ),
    ).toEqual({ cleanupId: CLEANUP_ID, token: TOKEN })
  })
})
