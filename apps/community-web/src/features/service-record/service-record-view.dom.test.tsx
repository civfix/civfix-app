import * as React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"

const verifyServiceHoursCertificate = vi.fn()

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})
vi.mock("next/navigation", () => ({ useRouter: () => ({ back: () => {}, push: () => {} }) }))
vi.mock("@/components/detail-shell", () => ({
  DetailShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  api: {
    verifyServiceHoursCertificate: (...args: unknown[]) => verifyServiceHoursCertificate(...args),
  },
}))

const { ServiceRecordView } = await import("./service-record-view")

// The shape Next's app router leaves on its own history entries; __NA marks an entry it wrote itself.
const NEXT_ROUTER_STATE = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ["", {}] }

function nextRouterMarked(): boolean {
  return (window.history.state as { __NA?: unknown } | null)?.__NA !== undefined
}

beforeEach(() => {
  verifyServiceHoursCertificate.mockReset()
  verifyServiceHoursCertificate.mockRejectedValue(new TypeError("Failed to fetch"))
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, "", "/")
})

describe("ServiceRecordView address bar", () => {
  it("writes a typed code's permalink as an unmarked entry so Next's router adopts it", async () => {
    window.history.replaceState(NEXT_ROUTER_STATE, "", "/service-record/")
    render(<ServiceRecordView />)

    fireEvent.change(screen.getByPlaceholderText("code_placeholder"), {
      target: { value: "CFX-A1B2-C3D4-E5F6" },
    })
    fireEvent.click(screen.getByRole("button", { name: "verify" }))

    expect(window.location.pathname).toBe("/service-record/A1B2C3D4E5F6/")
    expect(nextRouterMarked()).toBe(false)
    await screen.findByRole("button", { name: "try_again" })
  })

  it("clears the code from the address bar as an unmarked entry when the verifier starts over", async () => {
    window.history.replaceState(NEXT_ROUTER_STATE, "", "/service-record/CFX-A1B2-C3D4-E5F6/")
    render(<ServiceRecordView />)

    fireEvent.click(await screen.findByRole("button", { name: "try_again" }))

    expect(window.location.pathname).toBe("/service-record/")
    expect(nextRouterMarked()).toBe(false)
  })
})

describe("service record fingerprint copy", () => {
  it("announces the copy confirmation through a live status region outside the labelled button", async () => {
    verifyServiceHoursCertificate.mockResolvedValue({
      code: "A1B2C3D4E5F6",
      status: "valid",
      holderName: "Ada",
      issuedAt: "2026-01-01T00:00:00.000Z",
      totalHours: 3,
      entryCount: 1,
      documentSha256: "ab".repeat(32),
    })
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(async () => {}) },
    })
    window.history.replaceState(null, "", "/service-record/CFX-A1B2-C3D4-E5F6/")
    await act(async () => {
      render(<ServiceRecordView />)
    })
    const button = screen.getByLabelText("fingerprint_copy_a11y")
    await act(async () => {
      fireEvent.click(button)
    })
    const status = screen.getByRole("status")
    expect(status.textContent).toBe("copied")
    expect(button.contains(status)).toBe(false)
  })
})
