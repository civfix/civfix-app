import { describe, expect, it, vi, beforeEach } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type {
  InviteOrganizationMemberResponse,
  OrganizationDTO,
  OrganizationInviteDTO,
  OrganizationMemberDTO,
  PersonDTO,
} from "@civfix/shared"
import {
  InviteOrganizationMemberRequestSchema,
  RevokeOrganizationInviteRequestSchema,
  SetOrganizationMemberRoleRequestSchema,
} from "@civfix/shared"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "@/components/console/__testing__/harness"
import { ConsoleOrgProvider } from "../console-context"
import { MembersScreen, SETTABLE_ORG_ROLES } from "./members-screen"

const ORG_ID = "11111111-1111-4111-8111-111111111111"
const OWNER_ID = "22222222-2222-4222-8222-222222222222"
const MEMBER_ID = "44444444-4444-4444-8444-444444444444"

function person(over: Partial<PersonDTO> = {}): PersonDTO {
  return {
    id: MEMBER_ID,
    name: "Rosa",
    handle: "rosa",
    avatar: { seed: "rosa", palette: "moss" },
    followers: 0,
    following: 0,
    isFollowing: false,
    ...over,
  } as PersonDTO
}

function member(over: Partial<OrganizationMemberDTO> = {}): OrganizationMemberDTO {
  return {
    person: person(),
    role: "member",
    joinedAt: "2026-04-01T00:00:00.000Z",
    canRemove: true,
    ...over,
  }
}

const OWNER_ROW = member({
  person: person({ id: OWNER_ID, name: "Ada", handle: "ada" }),
  role: "owner",
  canRemove: false,
})

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

const DAY_MS = 24 * 60 * 60 * 1000

function invite(over: Partial<OrganizationInviteDTO> = {}): OrganizationInviteDTO {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    organizationId: ORG_ID,
    email: "rosa@example.org",
    user: null,
    role: "member",
    status: "pending",
    invitedBy: person({ id: OWNER_ID, name: "Ada", handle: "ada" }),
    createdAt: new Date(Date.now() - DAY_MS).toISOString(),
    // 13.5 days out reads "14 days" (rounded up), never "13.5" or "0".
    expiresAt: new Date(Date.now() + 13.5 * DAY_MS).toISOString(),
    ...over,
  }
}

function renderMembers(
  members: OrganizationMemberDTO[],
  viewer: OrganizationDTO = org(),
  options: {
    invites?: OrganizationInviteDTO[]
    inviteResult?: InviteOrganizationMemberResponse
  } = {},
) {
  // The invites read reflects a write once it lands, as the real API does after an invite.
  let invites = options.invites ?? []
  const client = {
    listOrganizationMembers: vi.fn().mockResolvedValue({ items: members, nextCursor: null }),
    setOrganizationMemberRole: vi.fn().mockResolvedValue({ ok: true }),
    removeOrganizationMember: vi.fn().mockResolvedValue({ ok: true }),
    inviteOrganizationMember: vi.fn().mockImplementation(() => {
      const result = options.inviteResult ?? { ok: true, member: null, invited: true }
      if (result.invite) invites = [...invites, result.invite]
      return Promise.resolve(result)
    }),
    listOrganizationInvites: vi.fn().mockImplementation(() => Promise.resolve({ items: invites })),
    revokeOrganizationInvite: vi.fn().mockResolvedValue({ ok: true }),
  }
  const view = renderConsole(
    <ConsoleOrgProvider org={viewer}>
      <MembersScreen />
    </ConsoleOrgProvider>,
    { api: client as never },
  )
  return { ...view, client }
}

beforeEach(() => {
  window.history.replaceState(null, "", `/manage/orgs/${ORG_ID}/members/`)
})

describe("SETTABLE_ORG_ROLES", () => {
  it("is exactly what the contract accepts - never owner", () => {
    for (const role of SETTABLE_ORG_ROLES) {
      expect(
        SetOrganizationMemberRoleRequestSchema.safeParse({ id: ORG_ID, userId: MEMBER_ID, role })
          .success,
      ).toBe(true)
    }
    expect(
      SetOrganizationMemberRoleRequestSchema.safeParse({ id: ORG_ID, userId: MEMBER_ID, role: "owner" })
        .success,
    ).toBe(false)
  })
})

describe("MembersScreen roles", () => {
  it("offers the role cell to the owner for members, never for the owner row", async () => {
    renderMembers([OWNER_ROW, member()])
    const select = await screen.findByLabelText("role.change_a11y(name=Rosa)")
    const values = Array.from(select.querySelectorAll("option")).map((o) => o.getAttribute("value"))
    expect(values).toEqual(["admin", "member"])
    expect(screen.queryByLabelText("role.change_a11y(name=Ada)")).toBeNull()
  })

  it("confirms before writing, and sends the chosen role", async () => {
    const user = userEvent.setup()
    const { client } = renderMembers([OWNER_ROW, member()])
    await user.selectOptions(await screen.findByLabelText("role.change_a11y(name=Rosa)"), "admin")

    expect(await screen.findByText("role.confirm_title")).toBeTruthy()
    expect(client.setOrganizationMemberRole).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "role.confirm_action" }))
    await waitFor(() =>
      expect(client.setOrganizationMemberRole).toHaveBeenCalledWith({
        id: ORG_ID,
        userId: MEMBER_ID,
        role: "admin",
      }),
    )
  })

  it("hides the role cell from an admin viewer but still lets them invite", async () => {
    renderMembers([OWNER_ROW, member()], org({ myRole: "admin" }))
    await screen.findByText("Rosa")
    expect(screen.queryByLabelText("role.change_a11y(name=Rosa)")).toBeNull()
    expect(screen.getByRole("button", { name: /invite\.action/ })).toBeTruthy()
    expect(screen.getByText("members.read_only")).toBeTruthy()
  })

  it("hides invite and role controls from a plain member", async () => {
    renderMembers([OWNER_ROW, member()], org({ myRole: "member" }))
    await screen.findByText("Rosa")
    expect(screen.queryByRole("button", { name: /invite\.action/ })).toBeNull()
    expect(screen.queryByLabelText("role.change_a11y(name=Rosa)")).toBeNull()
  })
})

describe("MembersScreen removal", () => {
  it("only offers Remove where the server says canRemove, and confirms first", async () => {
    const user = userEvent.setup()
    const { client } = renderMembers([
      OWNER_ROW,
      member(),
      member({ person: person({ id: "55555555-5555-4555-8555-555555555555", name: "Sam" }), canRemove: false }),
    ])
    await screen.findByText("Sam")
    expect(screen.queryByRole("button", { name: "remove.a11y(name=Sam)" })).toBeNull()
    expect(screen.queryByRole("button", { name: "remove.a11y(name=Ada)" })).toBeNull()

    await user.click(screen.getByRole("button", { name: "remove.a11y(name=Rosa)" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText("remove.confirm_title")).toBeTruthy()
    expect(client.removeOrganizationMember).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole("button", { name: "remove.action" }))
    await waitFor(() =>
      expect(client.removeOrganizationMember).toHaveBeenCalledWith({ id: ORG_ID, userId: MEMBER_ID }),
    )
  })
})

describe("MembersScreen invite drawer", () => {
  it("sends a handle invite with the chosen role and closes", async () => {
    const user = userEvent.setup()
    const { client } = renderMembers([OWNER_ROW])
    await user.click(await screen.findByRole("button", { name: /invite\.action/ }))

    const drawer = await screen.findByRole("dialog", { name: "invite.title" })
    await user.type(within(drawer).getByLabelText("invite.handle"), "@rosa")
    await user.selectOptions(within(drawer).getByLabelText("invite.role"), "admin")
    await user.click(within(drawer).getByRole("button", { name: "invite.send" }))

    await waitFor(() =>
      expect(client.inviteOrganizationMember).toHaveBeenCalledWith({
        id: ORG_ID,
        identifierKind: "handle",
        identifier: "rosa",
        role: "admin",
      }),
    )
    const sent = client.inviteOrganizationMember.mock.calls[0]?.[0]
    expect(InviteOrganizationMemberRequestSchema.safeParse(sent).success).toBe(true)
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "invite.title" })).toBeNull())
  })

  it("switching to an email invite explains the emailed link and its expiry", async () => {
    const user = userEvent.setup()
    renderMembers([OWNER_ROW])
    await user.click(await screen.findByRole("button", { name: /invite\.action/ }))
    const drawer = await screen.findByRole("dialog", { name: "invite.title" })
    await user.click(within(drawer).getByRole("button", { name: "invite.by_email" }))
    expect(within(drawer).getByText("invite.email_hint(days=14)")).toBeTruthy()
    expect(within(drawer).getByLabelText("invite.email").getAttribute("type")).toBe("email")
  })

  it("shows the pending invite it created, stays open, and the list below picks it up", async () => {
    const user = userEvent.setup()
    const created = invite({ email: "sam@example.org" })
    const { client } = renderMembers([OWNER_ROW], org(), {
      inviteResult: { ok: true, member: null, invited: true, invite: created },
    })
    await screen.findByText("Ada")
    expect(screen.queryByText("invites.title")).toBeNull()

    await user.click(screen.getByRole("button", { name: /invite\.action/ }))
    const drawer = await screen.findByRole("dialog", { name: "invite.title" })
    await user.click(within(drawer).getByRole("button", { name: "invite.by_email" }))
    await user.type(within(drawer).getByLabelText("invite.email"), "sam@example.org")
    await user.click(within(drawer).getByRole("button", { name: "invite.send" }))

    const sent = await within(drawer).findByTestId("org-invite-sent")
    expect(sent.textContent).toContain("invite.sent_email_body(email=sam@example.org,count=14)")
    expect(within(drawer).queryByRole("button", { name: "invite.send" })).toBeNull()

    // The invites query was invalidated: the list under the roster now shows the new row.
    const section = await screen.findByRole("region", { name: "invites.title" })
    expect(within(section).getByText("sam@example.org")).toBeTruthy()
    expect(client.listOrganizationInvites.mock.calls.length).toBeGreaterThanOrEqual(2)

    await user.click(within(drawer).getByRole("button", { name: "invite.done" }))
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "invite.title" })).toBeNull())
  })
})

describe("MembersScreen pending invites", () => {
  it("lists pending and expired invites with who, role, inviter and expiry", async () => {
    renderMembers([OWNER_ROW], org(), {
      invites: [
        invite(),
        invite({
          id: "55555555-5555-4555-8555-555555555555",
          email: null,
          user: person({ id: "66666666-6666-4666-8666-666666666666", name: "Sam", handle: "sam" }),
          role: "admin",
          status: "expired",
          expiresAt: new Date(Date.now() - DAY_MS).toISOString(),
        }),
        invite({ id: "77777777-7777-4777-8777-777777777777", email: "gone@example.org", status: "revoked" }),
      ],
    })

    const section = await screen.findByRole("region", { name: "invites.title" })
    expect(within(section).getByText("invites.subtitle(days=14)")).toBeTruthy()
    expect(within(section).getByText("rosa@example.org")).toBeTruthy()
    const subs = within(section).getAllByText(/invites\.invited_by\(name=Ada\)/)
    expect(subs.map((node) => node.textContent)).toEqual([
      "invites.invited_by(name=Ada) · invites.expires_in(count=14)",
      "invites.invited_by(name=Ada) · invites.expired",
    ])
    expect(within(section).getByText("Sam")).toBeTruthy()
    expect(within(section).getByText("@sam")).toBeTruthy()
    expect(within(section).getByText("invites.status_expired")).toBeTruthy()
    expect(within(section).queryByText("gone@example.org")).toBeNull()
    // Only the pending row can be revoked.
    expect(within(section).getByRole("button", { name: "invites.revoke_a11y(name=rosa@example.org)" })).toBeTruthy()
    expect(within(section).queryByRole("button", { name: "invites.revoke_a11y(name=Sam)" })).toBeNull()
  })

  it("hides the section entirely when there is nothing pending", async () => {
    renderMembers([OWNER_ROW], org(), { invites: [] })
    await screen.findByText("Ada")
    expect(screen.queryByRole("region", { name: "invites.title" })).toBeNull()
  })

  it("does not even ask for invites as a plain member", async () => {
    const { client } = renderMembers([OWNER_ROW, member()], org({ myRole: "member" }), {
      invites: [invite()],
    })
    await screen.findByText("Rosa")
    expect(client.listOrganizationInvites).not.toHaveBeenCalled()
    expect(screen.queryByRole("region", { name: "invites.title" })).toBeNull()
  })

  it("confirms before revoking, then sends the contract shape", async () => {
    const user = userEvent.setup()
    const { client } = renderMembers([OWNER_ROW], org(), { invites: [invite()] })
    const section = await screen.findByRole("region", { name: "invites.title" })
    await user.click(
      within(section).getByRole("button", { name: "invites.revoke_a11y(name=rosa@example.org)" }),
    )
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText("invites.revoke_title")).toBeTruthy()
    expect(client.revokeOrganizationInvite).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole("button", { name: "invites.revoke" }))
    await waitFor(() =>
      expect(client.revokeOrganizationInvite).toHaveBeenCalledWith({
        id: ORG_ID,
        inviteId: "33333333-3333-4333-8333-333333333333",
      }),
    )
    const sent = client.revokeOrganizationInvite.mock.calls[0]?.[0]
    expect(RevokeOrganizationInviteRequestSchema.safeParse(sent).success).toBe(true)
  })
})

describe("MembersScreen suspended org", () => {
  it("keeps the roster readable but disables inviting, role changes, removal and revoking", async () => {
    renderMembers([OWNER_ROW, member()], org({ suspended: true }), { invites: [invite()] })
    await screen.findByText("Rosa")
    const inviteButton = screen.getByRole("button", { name: /invite\.action/ }) as HTMLButtonElement
    expect(inviteButton.disabled).toBe(true)
    const roleSelect = screen.getByLabelText("role.change_a11y(name=Rosa)") as HTMLSelectElement
    expect(roleSelect.disabled).toBe(true)
    expect(roleSelect.title).toBe("suspended.error_forbidden")
    const removeButton = screen.getByRole("button", { name: "remove.a11y(name=Rosa)" }) as HTMLButtonElement
    expect(removeButton.disabled).toBe(true)
    const section = await screen.findByRole("region", { name: "invites.title" })
    const revoke = within(section).getByRole("button", {
      name: "invites.revoke_a11y(name=rosa@example.org)",
    }) as HTMLButtonElement
    expect(revoke.disabled).toBe(true)
  })
})
