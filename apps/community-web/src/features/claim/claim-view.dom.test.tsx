import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}))
vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})
vi.mock("@civfix/ui", () => ({ StatusBadge: () => null }))
vi.mock("@/components/detail-shell", () => ({
  DetailShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock("@/lib/api", () => ({
  api: {
    claimNudge: () => Promise.reject(new Error("no pending claim")),
    claimReport: () => Promise.reject(new Error("not expected")),
  },
}))
vi.mock("@/hooks/use-auth", () => ({ useIsAuthenticated: () => false }))

const { ClaimView } = await import("./claim-view")
const { readClaimHandoff, clearClaimHandoff } = await import("@/store/claim-handoff")

// The shape Next's app router leaves on its own history entries; __NA marks an entry it wrote itself.
const NEXT_ROUTER_STATE = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ["", {}] }

function renderAt(url: string) {
  window.history.replaceState(NEXT_ROUTER_STATE, "", url)
  render(<ClaimView />)
}

beforeEach(() => {
  clearClaimHandoff()
})

afterEach(() => {
  cleanup()
})

describe("ClaimView", () => {
  it("takes the claim code out of the address bar once it has it", () => {
    renderAt("/claim/?code=CLAIM-CODE-1&report=report-1&ref=mail")

    expect(window.location.pathname).toBe("/claim/")
    expect(window.location.search).toBe("?ref=mail")
    // Next's patched replaceState skips syncing its router for an entry marked __NA, and would later
    // write ?code= back; an unmarked call is adopted (Next copies its own internals onto it).
    expect((window.history.state as { __NA?: unknown } | null)?.__NA).toBeUndefined()
    expect(screen.getByText("intro.signIn")).toBeTruthy()
  })

  it("keeps the claim working after a reload of the cleaned-up address", () => {
    renderAt("/claim/?code=CLAIM-CODE-1&report=report-1")
    expect(readClaimHandoff()).toEqual({ reportId: "report-1", claimCode: "CLAIM-CODE-1" })
    cleanup()

    render(<ClaimView />)
    expect(screen.getByText("intro.signIn")).toBeTruthy()
  })

  it("keeps a code that arrived without a report id for a reload or sign-in round trip", () => {
    renderAt("/claim/?code=CLAIM-CODE-2")

    expect(window.location.search).toBe("")
    expect(readClaimHandoff()).toEqual({ reportId: null, claimCode: "CLAIM-CODE-2" })
  })

  it("leaves an address without a claim code alone", () => {
    renderAt("/claim/?ref=mail")
    expect(window.location.search).toBe("?ref=mail")
  })
})
