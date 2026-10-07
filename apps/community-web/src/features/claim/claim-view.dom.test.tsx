import * as React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type * as ApiModule from "@/lib/api"
import { AppError, ErrorCode } from "@civfix/shared"

const claimNudge = vi.fn<(...args: unknown[]) => unknown>()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: () => {}, push: () => {} }),
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
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  api: {
    claimNudge: (...args: unknown[]) => claimNudge(...args),
    claimReport: () => Promise.reject(new Error("not expected")),
  },
}))
vi.mock("@/hooks/use-auth", () => ({ useIsAuthenticated: () => false }))

const { ClaimView } = await import("./claim-view")
const { readClaimHandoff } = await import("@/store/claim-handoff")

// The shape Next's app router leaves on its own history entries; __NA marks an entry it wrote itself.
const NEXT_ROUTER_STATE = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ["", {}] }

function renderAt(url: string) {
  window.history.replaceState(NEXT_ROUTER_STATE, "", url)
  render(<ClaimView />)
}

async function renderView() {
  await act(async () => {
    render(<ClaimView />)
  })
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, "", "/claim/")
  claimNudge.mockReset()
  claimNudge.mockRejectedValue(new AppError(ErrorCode.NOT_FOUND, "none"))
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

describe("ClaimView pending-claim lookup", () => {
  it("shows 'nothing to claim' when the server has no pending claim", async () => {
    await renderView()
    expect(screen.getByText("empty.title")).toBeTruthy()
    expect(screen.queryByText("lookup_failed.title")).toBeNull()
  })

  it("offers a retry instead of 'nothing to claim' when the lookup could not reach civfix", async () => {
    claimNudge.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    await renderView()
    expect(screen.getByText("lookup_failed.title")).toBeTruthy()
    expect(screen.queryByText("empty.title")).toBeNull()

    claimNudge.mockRejectedValueOnce(new AppError(ErrorCode.NOT_FOUND, "none"))
    await act(async () => {
      fireEvent.click(screen.getByText("error.retry"))
    })
    expect(claimNudge).toHaveBeenCalledTimes(2)
    expect(screen.getByText("empty.title")).toBeTruthy()
  })
})
