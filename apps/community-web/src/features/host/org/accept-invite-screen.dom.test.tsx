import { describe, expect, it, vi, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AcceptOrganizationInviteRequestSchema, AppError, ErrorCode } from "@civfix/shared"
import type { OrganizationDTO } from "@civfix/shared"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "@/components/console/__testing__/harness"
import { ConsoleNavigationProvider } from "../console-context"
import { AcceptInviteScreen } from "./accept-invite-screen"
import { ORG_INVITE_TOKEN_STASH_KEY } from "./org-invites"

const ORG_ID = "11111111-1111-4111-8111-111111111111"
const TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789ABCD"

function org(over: Partial<OrganizationDTO> = {}): OrganizationDTO {
  return {
    id: ORG_ID,
    slug: "river-keepers",
    name: "River Keepers",
    verifiedStatus: "unverified",
    createdAt: "2026-09-01T00:00:00.000Z",
    myRole: "member",
    ...over,
  }
}

function renderAccept(
  token: string | null,
  accept = vi.fn().mockResolvedValue({ ok: true, organization: org(), role: "member" }),
) {
  const client = {
    acceptOrganizationInvite: accept,
    listMyOrganizations: vi.fn().mockResolvedValue({ items: [] }),
  }
  const view = renderConsole(
    <ConsoleNavigationProvider>
      <AcceptInviteScreen token={token} />
    </ConsoleNavigationProvider>,
    { api: client as never },
  )
  return { ...view, client }
}

beforeEach(() => {
  window.sessionStorage.clear()
  window.history.replaceState(null, "", `/manage/org-invites/accept/?token=${TOKEN}`)
})

describe("AcceptInviteScreen", () => {
  it("accepts on click, then lands on the org overview and clears the stash", async () => {
    const user = userEvent.setup()
    window.sessionStorage.setItem(ORG_INVITE_TOKEN_STASH_KEY, TOKEN)
    const { client } = renderAccept(TOKEN)

    expect(client.acceptOrganizationInvite).not.toHaveBeenCalled()
    await user.click(await screen.findByRole("button", { name: "accept.action" }))

    await waitFor(() =>
      expect(client.acceptOrganizationInvite).toHaveBeenCalledWith({ token: TOKEN }),
    )
    const sent: unknown = client.acceptOrganizationInvite.mock.calls[0]?.[0]
    expect(AcceptOrganizationInviteRequestSchema.safeParse(sent).success).toBe(true)
    await waitFor(() => expect(window.location.pathname).toBe(`/manage/orgs/${ORG_ID}/`))
    expect(window.sessionStorage.getItem(ORG_INVITE_TOKEN_STASH_KEY)).toBeNull()
  })

  it("names the seated role - owner, admin or member - in the success toast", async () => {
    const user = userEvent.setup()
    for (const role of ["owner", "admin", "member"] as const) {
      const view = renderAccept(
        TOKEN,
        vi.fn().mockResolvedValue({ ok: true, organization: org({ myRole: role }), role }),
      )
      await user.click(await screen.findByRole("button", { name: "accept.action" }))
      expect(await screen.findAllByText(new RegExp(`accept\\.joined_as_${role}`))).not.toHaveLength(0)
      view.unmount()
    }
  })

  it("forgets the stash on Not now, so the console stops steering back here", async () => {
    const user = userEvent.setup()
    window.sessionStorage.setItem(ORG_INVITE_TOKEN_STASH_KEY, TOKEN)
    const { client } = renderAccept(TOKEN)
    await user.click(await screen.findByRole("button", { name: "accept.not_now" }))
    await waitFor(() => expect(window.location.pathname).toBe("/manage/"))
    expect(window.sessionStorage.getItem(ORG_INVITE_TOKEN_STASH_KEY)).toBeNull()
    expect(client.acceptOrganizationInvite).not.toHaveBeenCalled()
  })

  it("falls back to the stashed token when the URL has none", async () => {
    const user = userEvent.setup()
    window.sessionStorage.setItem(ORG_INVITE_TOKEN_STASH_KEY, TOKEN)
    window.history.replaceState(null, "", "/manage/org-invites/accept/")
    const { client } = renderAccept(null)

    await user.click(await screen.findByRole("button", { name: "accept.action" }))
    await waitFor(() =>
      expect(client.acceptOrganizationInvite).toHaveBeenCalledWith({ token: TOKEN }),
    )
  })

  it("maps NOT_FOUND to the invalid/revoked state with a way back, and drops the stash", async () => {
    const user = userEvent.setup()
    window.sessionStorage.setItem(ORG_INVITE_TOKEN_STASH_KEY, TOKEN)
    renderAccept(
      TOKEN,
      vi.fn().mockRejectedValue(new AppError(ErrorCode.NOT_FOUND, "no longer valid")),
    )

    await user.click(await screen.findByRole("button", { name: "accept.action" }))

    const alert = await screen.findByTestId("org-invite-problem")
    expect(alert.textContent).toContain("accept.error_invalid_title")
    expect(screen.getByRole("button", { name: "action.back_to_events" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "accept.action" })).toBeNull()
    expect(window.sessionStorage.getItem(ORG_INVITE_TOKEN_STASH_KEY)).toBeNull()
  })

  it("maps CONFLICT to expired and FORBIDDEN to the wrong-email state", async () => {
    const user = userEvent.setup()
    const expired = renderAccept(
      TOKEN,
      vi.fn().mockRejectedValue(new AppError(ErrorCode.CONFLICT, "expired")),
    )
    await user.click(await screen.findByRole("button", { name: "accept.action" }))
    expect((await screen.findByTestId("org-invite-problem")).textContent).toContain("accept.error_expired_title")
    expired.unmount()

    renderAccept(TOKEN, vi.fn().mockRejectedValue(new AppError(ErrorCode.FORBIDDEN, "nope")))
    await user.click(await screen.findByRole("button", { name: "accept.action" }))
    expect((await screen.findByTestId("org-invite-problem")).textContent).toContain(
      "accept.error_wrong_email_title",
    )
  })

  it("never calls the API for a missing or malformed token", async () => {
    const { client } = renderAccept("short")
    expect((await screen.findByTestId("org-invite-problem")).textContent).toContain("accept.error_invalid_title")
    expect(screen.queryByRole("button", { name: "accept.action" })).toBeNull()
    expect(client.acceptOrganizationInvite).not.toHaveBeenCalled()
  })
})
