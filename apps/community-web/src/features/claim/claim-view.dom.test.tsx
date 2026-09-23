import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type * as ApiModule from "@/lib/api"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { AppError, ErrorCode } from "@civfix/shared"

const claimNudge = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: () => {}, push: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})
vi.mock("@civfix/ui", () => ({ StatusBadge: () => null }))
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  api: { claimNudge: (...args: unknown[]) => claimNudge(...args) },
}))

import { ClaimView } from "@/features/claim/claim-view"

async function renderView() {
  await act(async () => {
    render(<ClaimView />)
  })
}

beforeEach(() => {
  window.localStorage.clear()
  claimNudge.mockReset()
})

afterEach(() => {
  cleanup()
})

describe("ClaimView pending-claim lookup", () => {
  it("shows 'nothing to claim' when the server has no pending claim", async () => {
    claimNudge.mockRejectedValue(new AppError(ErrorCode.NOT_FOUND, "none"))
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
