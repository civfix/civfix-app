import { describe, expect, it, vi, beforeEach } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { OrganizationDTO, OrganizationVerificationDTO } from "@civfix/shared"
import { ApplyOrganizationVerificationRequestSchema } from "@civfix/shared"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

vi.mock("@/components/console/forms/image-upload/upload", () => ({
  pickConsoleImage: vi.fn().mockResolvedValue({ kind: "image", uri: "blob:letter", mime: "image/jpeg" }),
  acceptDroppedImage: vi.fn().mockResolvedValue(null),
  uploadConsoleImage: vi
    .fn()
    .mockResolvedValue({ uploadId: "up_1", mediaId: "66666666-6666-4666-8666-666666666666", previewUrl: "blob:letter" }),
}))

import { renderConsole } from "@/components/console/__testing__/harness"
import { ConsoleOrgProvider } from "../console-context"
import { VerificationScreen, normalizeEin } from "./verification-screen"

const ORG_ID = "11111111-1111-4111-8111-111111111111"
const MEDIA_ID = "66666666-6666-4666-8666-666666666666"

function org(over: Partial<OrganizationDTO> = {}): OrganizationDTO {
  return {
    id: ORG_ID,
    slug: "river-keepers",
    name: "River Keepers",
    verifiedStatus: "unverified",
    createdAt: "2026-09-01T00:00:00.000Z",
    myRole: "owner",
    ...over,
  }
}

function renderVerification(
  current: OrganizationVerificationDTO,
  applied: OrganizationVerificationDTO = { status: "pending", kind: "nonprofit", submittedAt: "2026-09-08T00:00:00.000Z" },
) {
  // The server's read reflects the write once it lands, as the real API does after an apply.
  let latest = current
  const client = {
    getOrganizationVerification: vi.fn().mockImplementation(() => Promise.resolve(latest)),
    applyOrganizationVerification: vi.fn().mockImplementation(() => {
      latest = applied
      return Promise.resolve(applied)
    }),
  }
  const view = renderConsole(
    <ConsoleOrgProvider org={org()}>
      <VerificationScreen />
    </ConsoleOrgProvider>,
    { api: client as never },
  )
  return { ...view, client }
}

beforeEach(() => {
  window.history.replaceState(null, "", `/manage/orgs/${ORG_ID}/verification/`)
})

describe("EIN helpers", () => {
  it("formats digits as XX-XXXXXXX while typing and matches the contract regex", () => {
    expect(normalizeEin("123456789")).toBe("12-3456789")
    expect(normalizeEin("12-34")).toBe("12-34")
    expect(normalizeEin("1")).toBe("1")
    const einAccepted = (einNumber: string) =>
      ApplyOrganizationVerificationRequestSchema.safeParse({ id: ORG_ID, kind: "nonprofit", einNumber })
        .success
    expect(einAccepted("12-3456789")).toBe(true)
    expect(einAccepted("123456789")).toBe(true)
    expect(einAccepted("12-345")).toBe(false)
  })
})

describe("VerificationScreen", () => {
  it("shows the apply form for an unverified org and refuses to submit without documents", async () => {
    const user = userEvent.setup()
    const { client } = renderVerification({ status: "unverified", kind: null })
    expect(await screen.findByText("verification.unverified_title")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "verification.submit" }))
    expect(await screen.findAllByRole("alert")).not.toHaveLength(0)
    expect(screen.getAllByText(/verification\.field_documents: /)).not.toHaveLength(0)
    expect(client.applyOrganizationVerification).not.toHaveBeenCalled()
  })

  it("validates the EIN format before the confirm step", async () => {
    const user = userEvent.setup()
    const { client } = renderVerification({ status: "unverified", kind: null })
    await user.type(await screen.findByLabelText(/verification\.field_einNumber/), "12-34")
    await user.click(screen.getByRole("button", { name: "verification.submit" }))
    expect(await screen.findAllByText(/verification\.field_einNumber: /)).not.toHaveLength(0)
    expect(screen.queryByText("verification.confirm_title")).toBeNull()
    expect(client.applyOrganizationVerification).not.toHaveBeenCalled()
  })

  it("applies as a nonprofit with an EIN and a document after confirming, then shows pending", async () => {
    const user = userEvent.setup()
    const { client } = renderVerification({ status: "unverified", kind: null })

    await user.type(await screen.findByLabelText(/verification\.field_einNumber/), "123456789")
    await user.type(screen.getByLabelText(/verification\.field_note/), "Determination letter attached")
    await user.click(screen.getByRole("button", { name: /gallery\.add/ }))
    expect(await screen.findByRole("button", { name: "upload.remove" })).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "verification.submit" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText("verification.confirm_title")).toBeTruthy()
    expect(client.applyOrganizationVerification).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole("button", { name: "verification.submit" }))
    await waitFor(() =>
      expect(client.applyOrganizationVerification).toHaveBeenCalledWith({
        id: ORG_ID,
        kind: "nonprofit",
        einNumber: "12-3456789",
        documents: [{ mediaId: MEDIA_ID }],
        note: "Determination letter attached",
      }),
    )
    const sent: unknown = client.applyOrganizationVerification.mock.calls[0]?.[0]
    expect(ApplyOrganizationVerificationRequestSchema.safeParse(sent).success).toBe(true)

    expect(await screen.findByText("verification.pending_title")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "verification.submit" })).toBeNull()
  })

  it("lets a community group apply without documents", async () => {
    const user = userEvent.setup()
    const { client } = renderVerification({ status: "unverified", kind: null })
    await screen.findByText("verification.unverified_title")
    await user.click(screen.getByRole("button", { name: "enums:orgVerificationKind.community" }))
    expect(screen.queryByLabelText(/verification\.field_einNumber/)).toBeNull()

    await user.click(screen.getByRole("button", { name: "verification.submit" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "verification.submit" }))
    await waitFor(() =>
      expect(client.applyOrganizationVerification).toHaveBeenCalledWith({
        id: ORG_ID,
        kind: "community",
        documents: [],
      }),
    )
  })

  it("shows the reason and a re-apply path after a rejection", async () => {
    const user = userEvent.setup()
    renderVerification({
      status: "rejected",
      kind: "nonprofit",
      submittedAt: "2026-08-01T00:00:00.000Z",
      reviewedAt: "2026-08-03T00:00:00.000Z",
      rejectionReason: "The letter was for a different entity.",
    })
    expect(await screen.findByText("verification.rejected_title")).toBeTruthy()
    expect(screen.getByText(/different entity/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "verification.submit" })).toBeNull()

    await user.click(screen.getByRole("button", { name: "verification.reapply" }))
    expect(await screen.findByRole("button", { name: "verification.submit" })).toBeTruthy()
  })

  it("shows the badge and no form once verified", async () => {
    renderVerification({
      status: "verified",
      kind: "government",
      submittedAt: "2026-08-01T00:00:00.000Z",
      reviewedAt: "2026-08-03T00:00:00.000Z",
    })
    expect(await screen.findByText("verification.verified_title")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "verification.submit" })).toBeNull()
  })
})
