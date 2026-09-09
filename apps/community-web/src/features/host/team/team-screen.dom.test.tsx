import { describe, expect, it, vi, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { EventTeamMemberDTO, PersonDTO } from "@civfix/shared"
import { SetMemberRoleRequestSchema } from "@civfix/shared"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "@/components/console/__testing__/harness"
import { ConsoleEventProvider } from "../console-context"
import { SETTABLE_ROLES, TeamScreen } from "./team-screen"

const EVENT_ID = "33333333-3333-4333-8333-333333333333"
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

function member(over: Partial<EventTeamMemberDTO> = {}): EventTeamMemberDTO {
  return {
    person: person(),
    role: "member",
    joinedAt: "2026-04-01T00:00:00.000Z",
    canRemove: true,
    canChangeRole: true,
    ...over,
  }
}

function renderTeam(members: EventTeamMemberDTO[]) {
  const client = {
    listEventTeam: vi.fn().mockResolvedValue({ members, invites: [] }),
    setCleanupMemberRole: vi.fn().mockResolvedValue({ ok: true }),
    inviteEventTeamMember: vi.fn(),
    revokeEventTeamInvite: vi.fn(),
  }
  const view = renderConsole(
    <ConsoleEventProvider eventId={EVENT_ID} event={null}>
      <TeamScreen />
    </ConsoleEventProvider>,
    { api: client as never },
  )
  return { ...view, client }
}

beforeEach(() => {
  window.history.replaceState(null, "", `/manage/events/${EVENT_ID}/team/`)
})

describe("SETTABLE_ROLES", () => {
  it("is exactly what the contract accepts - and never the organizer", () => {
    for (const role of SETTABLE_ROLES) {
      expect(
        SetMemberRoleRequestSchema.safeParse({ id: EVENT_ID, userId: MEMBER_ID, role }).success,
      ).toBe(true)
    }
    expect(
      SetMemberRoleRequestSchema.safeParse({
        id: EVENT_ID,
        userId: MEMBER_ID,
        role: "organizer",
      }).success,
    ).toBe(false)
  })
})

describe("TeamScreen role cell", () => {
  it("offers co-host, staff and attendee", async () => {
    renderTeam([member()])
    const select = await screen.findByLabelText("role.change_a11y(name=Rosa)")
    const values = Array.from(select.querySelectorAll("option")).map((option) =>
      option.getAttribute("value"),
    )
    expect(values).toEqual(expect.arrayContaining(["cohost", "staff", "member"]))
    expect(values).not.toContain("organizer")
  })

  it("lets a STAFF member be moved, which the old two-value cell could not do", async () => {
    renderTeam([member({ role: "staff" })])
    expect(await screen.findByLabelText("role.change_a11y(name=Rosa)")).toBeTruthy()
  })

  it("never offers the cell for the organizer", async () => {
    renderTeam([member({ role: "organizer", canChangeRole: false })])
    await screen.findByText("Rosa")
    expect(screen.queryByLabelText("role.change_a11y(name=Rosa)")).toBeNull()
  })

  it("confirms before it writes, and sends the chosen role", async () => {
    const user = userEvent.setup()
    const { client } = renderTeam([member()])
    const select = await screen.findByLabelText("role.change_a11y(name=Rosa)")
    await user.selectOptions(select, "staff")

    expect(await screen.findByText("role.confirm_title")).toBeTruthy()
    expect(client.setCleanupMemberRole).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "role.confirm_action" }))
    await waitFor(() =>
      expect(client.setCleanupMemberRole).toHaveBeenCalledWith({
        id: EVENT_ID,
        userId: MEMBER_ID,
        role: "staff",
      }),
    )
  })

  it("writes nothing when the confirm is dismissed", async () => {
    const user = userEvent.setup()
    const { client } = renderTeam([member()])
    const select = await screen.findByLabelText("role.change_a11y(name=Rosa)")
    await user.selectOptions(select, "cohost")
    await screen.findByText("role.confirm_title")
    await user.click(screen.getByRole("button", { name: "action.cancel" }))
    await waitFor(() => expect(screen.queryByText("role.confirm_title")).toBeNull())
    expect(client.setCleanupMemberRole).not.toHaveBeenCalled()
  })
})
