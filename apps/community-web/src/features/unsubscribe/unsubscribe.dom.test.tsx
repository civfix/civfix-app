import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const unsubscribeBroadcasts = vi.fn()

vi.mock("@/lib/api", () => ({
  api: { unsubscribeBroadcasts: (...args: unknown[]) => unsubscribeBroadcasts(...args) },
}))

const { UnsubscribeView, unsubscribeTokenFromSearch } = await import("./unsubscribe-view")

const TOKEN = "t".repeat(40)

function renderAt(search: string) {
  window.history.replaceState(null, "", `/unsubscribe/${search}`)
  render(<UnsubscribeView />)
}

beforeEach(() => {
  unsubscribeBroadcasts.mockReset().mockResolvedValue({ ok: true })
})

afterEach(() => {
  cleanup()
})

describe("unsubscribeTokenFromSearch", () => {
  it("accepts a token inside the contract's bounds", () => {
    expect(unsubscribeTokenFromSearch(`?t=${TOKEN}`)).toBe(TOKEN)
  })

  it("rejects a truncated token rather than sending a request that cannot work", () => {
    expect(unsubscribeTokenFromSearch("?t=short")).toBe(null)
    expect(unsubscribeTokenFromSearch(`?t=${"t".repeat(513)}`)).toBe(null)
    expect(unsubscribeTokenFromSearch("")).toBe(null)
  })
})

describe("UnsubscribeView", () => {
  it("confirms ONLY after the server has accepted the request", async () => {
    renderAt(`?t=${TOKEN}`)
    expect(screen.getByRole("heading").textContent).toMatch(/Unsubscribing/i)
    expect(await screen.findByText(/You.re unsubscribed from this event.s messages/i)).toBeTruthy()
    expect(unsubscribeBroadcasts).toHaveBeenCalledWith({ token: TOKEN })
  })

  it("never claims success when the request failed", async () => {
    unsubscribeBroadcasts.mockRejectedValue(new Error("offline"))
    renderAt(`?t=${TOKEN}`)
    expect(await screen.findByText(/We couldn.t use this link/i)).toBeTruthy()
    expect(screen.queryByText(/You.re unsubscribed/i)).toBe(null)
  })

  it("never claims success when the link carried no usable token", async () => {
    renderAt("?t=short")
    expect(await screen.findByText(/We couldn.t use this link/i)).toBeTruthy()
    expect(unsubscribeBroadcasts).not.toHaveBeenCalled()
  })

  it("sends exactly one request", async () => {
    renderAt(`?t=${TOKEN}`)
    await screen.findByText(/You.re unsubscribed/i)
    expect(unsubscribeBroadcasts).toHaveBeenCalledTimes(1)
  })

  it("says nothing about whether the token was VALID, only whether we could use the link", async () => {
    renderAt(`?t=${TOKEN}`)
    await screen.findByText(/You.re unsubscribed/i)
    expect(document.body.textContent).not.toMatch(/expired|invalid|not found|already/i)
  })
})
