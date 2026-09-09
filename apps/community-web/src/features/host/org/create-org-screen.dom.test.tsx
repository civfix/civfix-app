import { describe, expect, it, vi, afterEach, beforeEach } from "vitest"
import { cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AppError, ErrorCode } from "@civfix/shared"
import type { OrganizationDTO } from "@civfix/shared"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "@/components/console/__testing__/harness"
import { ConsoleApp } from "../console-app"
import { ConsoleNavigationProvider } from "../console-context"
import { CreateOrgScreen } from "./create-org-screen"
import { OrgProfileForm, socialLinksFromDraft, EMPTY_ORG_DRAFT } from "./org-profile-form"

const ORG_ID = "11111111-1111-4111-8111-111111111111"

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

function makeClient(create = vi.fn().mockResolvedValue(org())) {
  return {
    createOrganization: create,
    updateOrganization: vi.fn(),
    listMyOrganizations: vi.fn().mockResolvedValue({ items: [] }),
  }
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, "", "/manage/orgs/new/")
})

// No vitest globals, so Testing Library's auto-cleanup is not registered; the console tree stays
// subscribed to history, so unmount it rather than let it react to the next test's URL.
afterEach(() => {
  cleanup()
})

describe("socialLinksFromDraft", () => {
  it("is null when every handle is blank, and only carries what was typed", () => {
    expect(socialLinksFromDraft(EMPTY_ORG_DRAFT)).toBeNull()
    expect(socialLinksFromDraft({ ...EMPTY_ORG_DRAFT, instagram: " riverkeepers " })).toEqual({
      instagram: "riverkeepers",
    })
  })

  it("drops a pasted leading @, like the invite drawer does for handles", () => {
    expect(socialLinksFromDraft({ ...EMPTY_ORG_DRAFT, x: "@riverkeepers", tiktok: " @rk " })).toEqual({
      x: "riverkeepers",
      tiktok: "rk",
    })
    // Only the first one: a handle that is nothing but "@" is blank.
    expect(socialLinksFromDraft({ ...EMPTY_ORG_DRAFT, instagram: "@" })).toBeNull()
  })
})

describe("OrgProfileForm (create)", () => {
  it("blocks an empty submit with a summary and never calls the API", async () => {
    const user = userEvent.setup()
    const client = makeClient()
    const onSaved = vi.fn()
    renderConsole(<OrgProfileForm mode="create" onSaved={onSaved} />, { api: client as never })

    await user.click(screen.getByRole("button", { name: "form.create_action" }))

    expect(await screen.findAllByRole("alert")).not.toHaveLength(0)
    expect(screen.getAllByText(/form\.name: /)).not.toHaveLength(0)
    expect(client.createOrganization).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it("derives the handle from the name until the host edits it", async () => {
    const user = userEvent.setup()
    renderConsole(<OrgProfileForm mode="create" onSaved={vi.fn()} />, { api: makeClient() as never })

    await user.type(screen.getByLabelText("form.name"), "River Keepers LA")
    const slug = screen.getByLabelText("form.slug") as HTMLInputElement
    expect(slug.value).toBe("river-keepers-la")

    await user.clear(slug)
    await user.type(slug, "Riverkeepers")
    expect(slug.value).toBe("riverkeepers")

    await user.type(screen.getByLabelText("form.name"), " Inc")
    expect(slug.value).toBe("riverkeepers")
  })

  it("rejects a malformed handle before it reaches the API", async () => {
    const user = userEvent.setup()
    const client = makeClient()
    renderConsole(<OrgProfileForm mode="create" onSaved={vi.fn()} />, { api: client as never })

    await user.type(screen.getByLabelText("form.name"), "River Keepers")
    const slug = screen.getByLabelText("form.slug")
    await user.clear(slug)
    await user.type(slug, "ab")
    await user.click(screen.getByRole("button", { name: "form.create_action" }))

    expect(await screen.findAllByText(/form\.slug_short/)).not.toHaveLength(0)
    expect(client.createOrganization).not.toHaveBeenCalled()
  })

  it("sends the trimmed body and reports the created org", async () => {
    const user = userEvent.setup()
    const client = makeClient()
    const onSaved = vi.fn()
    renderConsole(<OrgProfileForm mode="create" onSaved={onSaved} />, { api: client as never })

    await user.type(screen.getByLabelText("form.name"), "  River Keepers  ")
    await user.type(screen.getByLabelText(/form\.websiteUrl/), "https://riverkeepers.org")
    await user.type(screen.getByLabelText(/^Instagram/), "riverkeepers")
    await user.click(screen.getByRole("button", { name: "form.create_action" }))

    await waitFor(() =>
      expect(client.createOrganization).toHaveBeenCalledWith({
        name: "River Keepers",
        slug: "river-keepers",
        description: null,
        websiteUrl: "https://riverkeepers.org",
        logoMediaId: null,
        socialLinks: { instagram: "riverkeepers" },
      }),
    )
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(org()))
  })

  it("shows a CONFLICT as a taken handle on the slug field", async () => {
    const user = userEvent.setup()
    const client = makeClient(
      vi.fn().mockRejectedValue(new AppError(ErrorCode.CONFLICT, "slug taken")),
    )
    const onSaved = vi.fn()
    renderConsole(<OrgProfileForm mode="create" onSaved={onSaved} />, { api: client as never })

    await user.type(screen.getByLabelText("form.name"), "River Keepers")
    await user.click(screen.getByRole("button", { name: "form.create_action" }))

    expect(await screen.findAllByText(/form\.slug_taken/)).not.toHaveLength(0)
    expect(onSaved).not.toHaveBeenCalled()
  })

  it("reads a field-less VALIDATION about the handle as a reserved handle", async () => {
    const user = userEvent.setup()
    const client = makeClient(
      vi.fn().mockRejectedValue(new AppError(ErrorCode.VALIDATION, "That slug is reserved")),
    )
    renderConsole(<OrgProfileForm mode="create" onSaved={vi.fn()} />, { api: client as never })

    await user.type(screen.getByLabelText("form.name"), "River Keepers")
    await user.click(screen.getByRole("button", { name: "form.create_action" }))

    expect(await screen.findAllByText(/form\.slug_reserved/)).not.toHaveLength(0)
  })

  it("shows the server's field errors as they came, never as a reserved handle", async () => {
    const user = userEvent.setup()
    const client = makeClient(
      vi.fn().mockRejectedValue(
        new AppError(ErrorCode.VALIDATION, "invalid", {
          fields: { websiteUrl: "Must be reachable" },
        }),
      ),
    )
    renderConsole(<OrgProfileForm mode="create" onSaved={vi.fn()} />, { api: client as never })

    await user.type(screen.getByLabelText("form.name"), "River Keepers")
    await user.click(screen.getByRole("button", { name: "form.create_action" }))

    expect(await screen.findAllByText(/Must be reachable/)).not.toHaveLength(0)
    expect(screen.queryByText(/form\.slug_reserved/)).toBeNull()
  })

  it("leaves the handle alone for a field-less VALIDATION that is not about it", async () => {
    const user = userEvent.setup()
    const client = makeClient(
      vi.fn().mockRejectedValue(new AppError(ErrorCode.VALIDATION, "Too many organizations")),
    )
    renderConsole(<OrgProfileForm mode="create" onSaved={vi.fn()} />, { api: client as never })

    await user.type(screen.getByLabelText("form.name"), "River Keepers")
    await user.click(screen.getByRole("button", { name: "form.create_action" }))

    // The generic validation toast fires; the slug field stays "looks good".
    expect(await screen.findAllByText(/error\.validation/)).not.toHaveLength(0)
    expect(screen.queryByText(/form\.slug_reserved/)).toBeNull()
    expect(screen.getByText(/form\.slug_ok/)).toBeTruthy()
  })
})

describe("CreateOrgScreen", () => {
  it("lands on the new org's overview with the welcome flag after a successful create", async () => {
    const user = userEvent.setup()
    const client = makeClient()
    renderConsole(
      <ConsoleNavigationProvider>
        <CreateOrgScreen />
      </ConsoleNavigationProvider>,
      { api: client as never },
    )

    await user.type(await screen.findByLabelText("form.name"), "River Keepers")
    await user.click(screen.getByRole("button", { name: "form.create_action" }))

    await waitFor(() => expect(window.location.pathname).toBe(`/manage/orgs/${ORG_ID}/`))
    expect(window.location.search).toContain("tab=welcome")
  })

  it("renders the new org's overview at once, while the org list is still refetching", async () => {
    const user = userEvent.setup()
    // The list read reflects the create once it lands - slowly, as the real round trip does: the
    // refetch stays in flight until the test releases it.
    let created: OrganizationDTO | null = null
    let releaseRefetch: (() => void) | null = null
    const client = {
      createOrganization: vi.fn().mockImplementation(() => {
        created = org()
        return Promise.resolve(created)
      }),
      listMyOrganizations: vi.fn().mockImplementation(() => {
        if (created === null) return Promise.resolve({ items: [] })
        return new Promise<{ items: OrganizationDTO[] }>((resolve) => {
          releaseRefetch = () => resolve({ items: [org()] })
        })
      }),
      getOrganizationVerification: vi
        .fn()
        .mockResolvedValue({ status: "unverified", kind: null, submittedAt: null }),
    }
    renderConsole(<ConsoleApp />, { api: client as never })

    await user.type(await screen.findByLabelText("form.name"), "River Keepers")
    await user.click(screen.getByRole("button", { name: "form.create_action" }))

    // The welcome card is up before the refetch has resolved, and "not found" never showed.
    expect(await screen.findByText("next.welcome_title(name=River Keepers)")).toBeTruthy()
    expect(screen.queryByText("not_found_title")).toBeNull()
    expect(releaseRefetch).not.toBeNull()
    ;(releaseRefetch as unknown as () => void)()
    await waitFor(() => expect(client.listMyOrganizations.mock.calls.length).toBeGreaterThanOrEqual(2))
    expect(screen.getByText("next.welcome_title(name=River Keepers)")).toBeTruthy()
    expect(screen.queryByText("not_found_title")).toBeNull()
  })
})
