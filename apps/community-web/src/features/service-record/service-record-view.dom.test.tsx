import { afterEach, describe, expect, it, vi } from "vitest"
import type * as ApiModule from "@/lib/api"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

vi.mock("next/navigation", () => ({ useRouter: () => ({ back: () => {}, push: () => {} }) }))

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  api: {
    verifyServiceHoursCertificate: async () => ({
      code: "A1B2C3D4E5F6",
      status: "valid",
      holderName: "Ada",
      issuedAt: "2026-01-01T00:00:00.000Z",
      totalHours: 3,
      entryCount: 1,
      documentSha256: "ab".repeat(32),
    }),
  },
}))

import { ServiceRecordView } from "@/features/service-record/service-record-view"

afterEach(() => {
  cleanup()
  window.history.replaceState(null, "", "/")
})

describe("service record fingerprint copy", () => {
  it("announces the copy confirmation through a live status region outside the labelled button", async () => {
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
