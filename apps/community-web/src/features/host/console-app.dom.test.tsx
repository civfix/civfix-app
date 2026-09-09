import { describe, expect, it, vi, afterEach, beforeEach } from "vitest"
import { cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { OrganizationDTO } from "@civfix/shared"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "@/components/console/__testing__/harness"
import { useUiStore } from "@/store/ui-store"
import { ConsoleApp } from "./console-app"
import { ORG_INVITE_TOKEN_STASH_KEY } from "./org/org-invites"

const ORG_ID = "11111111-1111-4111-8111-111111111111"
const TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789ABCD"
const ACCEPT_PATH = "/manage/org-invites/accept/"

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

function makeClient() {
  // The list read reflects the accept once it lands, as the real API does.
  let joined: OrganizationDTO[] = []
  return {
    acceptOrganizationInvite: vi.fn().mockImplementation(() => {
      joined = [org()]
      return Promise.resolve({ ok: true, organization: org(), role: "member" })
    }),
    listMyOrganizations: vi.fn().mockImplementation(() => Promise.resolve({ items: joined })),
    getOrganizationVerification: vi
      .fn()
      .mockResolvedValue({ status: "unverified", kind: null, submittedAt: null }),
  }
}

beforeEach(() => {
  window.sessionStorage.clear()
  useUiStore.setState({ authModalOpen: false })
  window.history.replaceState(null, "", "/manage/")
})

// The whole console stays subscribed to history and the UI store, so a tree left mounted by an
// earlier test would strip the next test's token or open a second auth modal: unmount explicitly
// (there are no vitest globals, so Testing Library's auto-cleanup is not registered).
afterEach(() => {
  cleanup()
})

describe("ConsoleApp signed out", () => {
  it("stashes the invite token, keeps it in the URL, and offers the invite sign-in copy", async () => {
    window.history.replaceState(null, "", `${ACCEPT_PATH}#token=${TOKEN}`)
    renderConsole(<ConsoleApp />, { api: makeClient() as never, authenticated: false })

    expect(await screen.findByText("accept.signed_out_title")).toBeTruthy()
    expect(screen.getByText("accept.signed_out_body")).toBeTruthy()
    expect(screen.getByRole("button", { name: "accept.sign_in" })).toBeTruthy()
    expect(window.sessionStorage.getItem(ORG_INVITE_TOKEN_STASH_KEY)).toBe(TOKEN)
    // The auth modal keeps the URL, so an email OTP sign-in still finds the token there.
    expect(window.location.hash).toBe(`#token=${TOKEN}`)
  })

  it("opens the auth modal from the invite copy", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", `${ACCEPT_PATH}#token=${TOKEN}`)
    renderConsole(<ConsoleApp />, { api: makeClient() as never, authenticated: false })
    await user.click(await screen.findByRole("button", { name: "accept.sign_in" }))
    expect(useUiStore.getState().authModalOpen).toBe(true)
    expect(await screen.findByRole("dialog")).toBeTruthy()
    // Close it here: the modal is a body portal, which the harness's body reset would orphan.
    await user.click(screen.getByRole("button", { name: "close" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(useUiStore.getState().authModalOpen).toBe(false)
  })

  it("shows the plain signed-out state anywhere else, stashing nothing", async () => {
    renderConsole(<ConsoleApp />, { api: makeClient() as never, authenticated: false })
    expect(await screen.findByText("auth.signed_out_title")).toBeTruthy()
    expect(screen.queryByText("accept.signed_out_title")).toBeNull()
    expect(window.sessionStorage.getItem(ORG_INVITE_TOKEN_STASH_KEY)).toBeNull()
  })
})

describe("ConsoleApp invite token", () => {
  it("steers a boot with a stashed token to the accept page, wherever sign-in landed", async () => {
    const user = userEvent.setup()
    window.sessionStorage.setItem(ORG_INVITE_TOKEN_STASH_KEY, TOKEN)
    const client = makeClient()
    renderConsole(<ConsoleApp />, { api: client as never })

    await waitFor(() => expect(window.location.pathname).toBe(ACCEPT_PATH))
    await user.click(await screen.findByRole("button", { name: "accept.action" }))
    await waitFor(() =>
      expect(client.acceptOrganizationInvite).toHaveBeenCalledWith({ token: TOKEN }),
    )
    // Let the accept land (it navigates) before the test ends, so nothing leaks into the next one.
    await waitFor(() => expect(window.location.pathname).toBe(`/manage/orgs/${ORG_ID}/`))
  })

  it("does not redirect a boot without a stash", async () => {
    renderConsole(<ConsoleApp />, { api: makeClient() as never })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(window.location.pathname).toBe("/manage/")
  })

  it("strips the token from the URL once read, and still accepts with it", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", `${ACCEPT_PATH}#token=${TOKEN}`)
    const client = makeClient()
    renderConsole(<ConsoleApp />, { api: client as never })

    const accept = await screen.findByRole("button", { name: "accept.action" })
    await waitFor(() => expect(window.location.hash).toBe(""))
    expect(window.location.pathname).toBe(ACCEPT_PATH)
    expect(window.location.search).toBe("")

    await user.click(accept)
    await waitFor(() =>
      expect(client.acceptOrganizationInvite).toHaveBeenCalledWith({ token: TOKEN }),
    )
    await waitFor(() => expect(window.location.pathname).toBe(`/manage/orgs/${ORG_ID}/`))
    expect(window.sessionStorage.getItem(ORG_INVITE_TOKEN_STASH_KEY)).toBeNull()
  })

  it("does not spend the token again when Back returns to the accept page", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", `${ACCEPT_PATH}#token=${TOKEN}`)
    const client = makeClient()
    renderConsole(<ConsoleApp />, { api: client as never })

    await user.click(await screen.findByRole("button", { name: "accept.action" }))
    await waitFor(() => expect(window.location.pathname).toBe(`/manage/orgs/${ORG_ID}/`))
    // The org overview is up (its lazy chunk resolved and the accept page is unmounted) ...
    expect((await screen.findAllByText("River Keepers")).length).toBeGreaterThan(0)

    // ... then Back: the history entry is the stripped accept URL, the stash is gone.
    window.history.back()
    await waitFor(() => expect(window.location.pathname).toBe(ACCEPT_PATH))
    expect(window.location.hash).toBe("")
    expect((await screen.findByTestId("org-invite-problem")).textContent).toContain(
      "accept.error_invalid_title",
    )
    expect(screen.queryByRole("button", { name: "accept.action" })).toBeNull()
    expect(client.acceptOrganizationInvite).toHaveBeenCalledTimes(1)
  })
})
