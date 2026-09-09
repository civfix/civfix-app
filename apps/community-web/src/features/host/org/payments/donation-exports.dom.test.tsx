import { describe, expect, it, vi, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { HostExportDTO } from "@civfix/shared"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "@/components/console/__testing__/harness"
import { DonationExports, exportDisplayStatus } from "./donation-exports"

const ORG_ID = "11111111-1111-4111-8111-111111111111"

function row(over: Partial<HostExportDTO> = {}): HostExportDTO {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    cleanupId: null,
    organizationId: ORG_ID,
    kind: "donations",
    status: "ready",
    rowCount: 12,
    byteSize: 900,
    truncated: false,
    errorCode: null,
    requestedAt: "2026-05-01T10:00:00.000Z",
    completedAt: "2026-05-01T10:00:30.000Z",
    expiresAt: "2099-05-02T10:00:00.000Z",
    ...over,
  }
}

function renderExports(
  listResult: { items: HostExportDTO[]; nextCursor: null } | Error,
  over: Record<string, unknown> = {},
) {
  const client = {
    listOrgDonationExports:
      listResult instanceof Error
        ? vi.fn().mockRejectedValue(listResult)
        : vi.fn().mockResolvedValue(listResult),
    requestOrgDonationExport: vi.fn().mockResolvedValue(row({ status: "queued" })),
    downloadHostExport: vi.fn().mockResolvedValue({
      url: "https://objects.civfix.test/export.csv",
      expiresAt: "2026-05-01T10:10:00.000Z",
      filename: "donations.csv",
    }),
    ...over,
  }
  const view = renderConsole(<DonationExports orgId={ORG_ID} canView />, {
    api: client as never,
  })
  return { ...view, client }
}

let assign = vi.fn()

beforeEach(() => {
  assign = vi.fn()
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, assign },
  })
})

describe("DonationExports", () => {
  it("renders nothing for a member who cannot view donations", () => {
    const { container } = renderConsole(<DonationExports orgId={ORG_ID} canView={false} />, {
      api: { listOrgDonationExports: vi.fn() } as never,
    })
    expect(container.textContent).toBe("")
  })

  it("shows the empty state when the organization has never exported", async () => {
    renderExports({ items: [], nextCursor: null })
    expect(await screen.findByText("exports.empty_title")).toBeTruthy()
  })

  it("surfaces a failed read as an error with a retry, never as an empty ledger", async () => {
    renderExports(new Error("boom"))
    expect(await screen.findByText("state.error_title")).toBeTruthy()
    expect(screen.queryByText("exports.empty_title")).toBeNull()
  })

  it("requests an export and refreshes the list", async () => {
    const user = userEvent.setup()
    const { client } = renderExports({ items: [], nextCursor: null })
    await screen.findByText("exports.empty_title")
    await user.click(screen.getByRole("button", { name: /exports.request/ }))
    await waitFor(() => expect(client.requestOrgDonationExport).toHaveBeenCalledWith({ id: ORG_ID }))
    await waitFor(() => expect(client.listOrgDonationExports).toHaveBeenCalledTimes(2))
  })

  it("offers a download only for a READY row that has not expired, and follows the minted url", async () => {
    const user = userEvent.setup()
    const { client } = renderExports({ items: [row()], nextCursor: null })
    const button = await screen.findByRole("button", { name: "exports.download" })
    await user.click(button)
    await waitFor(() =>
      expect(client.downloadHostExport).toHaveBeenCalledWith({ id: row().id }),
    )
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://objects.civfix.test/export.csv"))
  })

  it("treats a ready row whose object has expired as expired: no download button", async () => {
    renderExports({
      items: [row({ expiresAt: "2020-01-01T00:00:00.000Z" })],
      nextCursor: null,
    })
    expect(await screen.findByText(/exports.expired/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "exports.download" })).toBeNull()
  })

  it("never says 'Available until <past date>' on a row the reaper already expired", async () => {
    renderExports({
      items: [row({ status: "expired", expiresAt: "2020-01-01T00:00:00.000Z" })],
      nextCursor: null,
    })
    expect(await screen.findByText(/exports.expired/)).toBeTruthy()
    expect(screen.queryByText(/exports.expires/)).toBeNull()
    expect(screen.getByText("enums:hostExportStatus.expired")).toBeTruthy()
  })

  it("names the reason a build failed instead of only colouring it red", async () => {
    renderExports({
      items: [row({ status: "failed", errorCode: "too_many_rows", expiresAt: null })],
      nextCursor: null,
    })
    expect(await screen.findByText(/exports.failed_reason\(code=too_many_rows\)/)).toBeTruthy()
  })

  it("shows a queued row with its status chip and no download", async () => {
    renderExports({
      items: [row({ status: "queued", rowCount: null, completedAt: null, expiresAt: null })],
      nextCursor: null,
    })
    expect(await screen.findByText("enums:hostExportStatus.queued")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "exports.download" })).toBeNull()
  })

  it("always states what an export contains", async () => {
    renderExports({ items: [row()], nextCursor: null })
    expect(await screen.findByText("exports.note")).toBeTruthy()
  })
})

describe("exportDisplayStatus", () => {
  const NOW = Date.parse("2026-06-01T00:00:00.000Z")

  it("is ONE state per row, so the chip and the caption can never disagree", () => {
    expect(exportDisplayStatus(row(), NOW)).toBe("ready")
    expect(exportDisplayStatus(row({ expiresAt: "2020-01-01T00:00:00.000Z" }), NOW)).toBe("expired")
    expect(exportDisplayStatus(row({ status: "expired" }), NOW)).toBe("expired")
    expect(exportDisplayStatus(row({ status: "queued", expiresAt: null }), NOW)).toBe("queued")
    expect(exportDisplayStatus(row({ status: "running", expiresAt: null }), NOW)).toBe("running")
    expect(exportDisplayStatus(row({ status: "failed", expiresAt: null }), NOW)).toBe("failed")
  })

  it("a ready row with no expiry stays ready", () => {
    expect(exportDisplayStatus(row({ expiresAt: null }), NOW)).toBe("ready")
  })
})
