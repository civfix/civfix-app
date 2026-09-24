import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const unsubscribeBroadcasts = vi.fn()

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

vi.mock("@/lib/api", () => ({
  api: { unsubscribeBroadcasts: (...args: unknown[]) => unsubscribeBroadcasts(...args) },
}))

const { UnsubscribeView, unsubscribeTokenFromSearch } = await import("./unsubscribe-view")

const TOKEN = "t".repeat(40)

function renderAt(search: string, { strict = false } = {}) {
  window.history.replaceState(null, "", `/unsubscribe/${search}`)
  render(strict ? <React.StrictMode><UnsubscribeView /></React.StrictMode> : <UnsubscribeView />)
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
    expect(screen.getByRole("heading").textContent).toBe("working.title")
    expect(await screen.findByText("done.title")).toBeTruthy()
    expect(unsubscribeBroadcasts).toHaveBeenCalledWith({ token: TOKEN })
  })

  it("never claims success when the request failed", async () => {
    unsubscribeBroadcasts.mockRejectedValue(new Error("offline"))
    renderAt(`?t=${TOKEN}`)
    expect(await screen.findByText("unusable.title")).toBeTruthy()
    expect(screen.queryByText("done.title")).toBe(null)
  })

  it("never claims success when the link carried no usable token", async () => {
    renderAt("?t=short")
    expect(await screen.findByText("unusable.title")).toBeTruthy()
    expect(unsubscribeBroadcasts).not.toHaveBeenCalled()
  })

  it("sends exactly one request", async () => {
    renderAt(`?t=${TOKEN}`)
    await screen.findByText("done.title")
    expect(unsubscribeBroadcasts).toHaveBeenCalledTimes(1)
  })

  it("settles under StrictMode's effect replay instead of hanging on 'Unsubscribing'", async () => {
    renderAt(`?t=${TOKEN}`, { strict: true })
    expect(await screen.findByText("done.title")).toBeTruthy()
    expect(unsubscribeBroadcasts).toHaveBeenCalledTimes(1)
  })
})
