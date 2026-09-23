import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { CleanupDTO, EventRegistrationDTO, EventSeatDTO } from "@civfix/shared"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "@/components/console/__testing__/harness"
import { ConsoleEventProvider, ConsoleNavigationProvider } from "../console-context"
import { AttendeesScreen } from "./attendees-screen"

const EVENT_ID = "33333333-3333-4333-8333-333333333333"
const EVENT = {
  id: EVENT_ID,
  title: "River day",
  timezone: "America/Los_Angeles",
  myCapabilities: ["manage_event", "check_in"],
} as unknown as CleanupDTO

function seat(id: string, over: Partial<EventSeatDTO> = {}): EventSeatDTO {
  return { id, seatIndex: 0, status: "active", checkedInAt: null, noShowAt: null, ...over }
}

function registration(over: Partial<EventRegistrationDTO> = {}): EventRegistrationDTO {
  return {
    id: "reg_1",
    cleanupId: EVENT_ID,
    kind: "guest",
    guestName: "Ada",
    partySize: 2,
    seatCount: 2,
    seats: [seat("s1"), seat("s2")],
    status: "registered",
    source: "self",
    registeredAt: "2026-09-12T17:00:00.000Z",
    checkedInAt: null,
    ...over,
  } as EventRegistrationDTO
}

function renderAttendees(rows: EventRegistrationDTO[]) {
  const client = {
    listEventTicketTypes: vi.fn().mockResolvedValue({ items: [] }),
    listEventRegistrations: vi.fn().mockResolvedValue({ items: rows, nextCursor: null }),
    removeEventRegistration: vi.fn().mockResolvedValue({ ok: true }),
    checkInEventSeat: vi.fn().mockResolvedValue({ ok: true }),
    getEventRegistrationAnswers: vi.fn().mockResolvedValue({ answers: [] }),
  }
  renderConsole(
    <ConsoleNavigationProvider>
      <ConsoleEventProvider eventId={EVENT_ID} event={EVENT}>
        <AttendeesScreen />
      </ConsoleEventProvider>
    </ConsoleNavigationProvider>,
    { api: client as never },
  )
  return client
}

beforeEach(() => {
  window.history.replaceState(null, "", `/manage/events/${EVENT_ID}/attendees/`)
})

afterEach(() => {
  cleanup()
})

describe("AttendeesScreen", () => {
  it("asks before removing the selected registrations, and passes the reason on", async () => {
    const user = userEvent.setup()
    const client = renderAttendees([registration()])
    await user.click(await screen.findByRole("checkbox", { name: "table.select_row(name=Ada)" }))
    await user.click(screen.getByRole("button", { name: /bulk\.remove/ }))
    expect(client.removeEventRegistration).not.toHaveBeenCalled()

    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText("bulk_remove.body(count=1)")).toBeTruthy()
    await user.type(within(dialog).getByLabelText(/remove\.reason/), "Duplicate")
    await user.click(within(dialog).getByRole("button", { name: "remove.confirm" }))
    await waitFor(() => expect(client.removeEventRegistration).toHaveBeenCalledTimes(1))
    expect(client.removeEventRegistration.mock.calls[0]![0]).toMatchObject({
      registrationId: "reg_1",
      reason: "Duplicate",
    })
  })

  it("closes the attendee drawer when the browser goes back", async () => {
    const user = userEvent.setup()
    renderAttendees([registration()])
    await user.click(await screen.findByRole("button", { name: "table.open_row(name=Ada)" }))
    expect(await screen.findByRole("dialog", { name: "Ada" })).toBeTruthy()

    await act(async () => {
      window.history.back()
      await new Promise((done) => window.addEventListener("popstate", done, { once: true }))
    })
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Ada" })).toBeNull())
  })

  it("closes the attendee drawer when a filter drops its row, so it cannot reopen later", async () => {
    const user = userEvent.setup()
    const client = renderAttendees([registration()])
    client.listEventRegistrations.mockImplementation(async (req: { filter?: string }) => ({
      items: req.filter === "checked_in" ? [] : [registration()],
      nextCursor: null,
    }))
    await user.click(await screen.findByRole("button", { name: "table.open_row(name=Ada)" }))
    expect(await screen.findByRole("dialog", { name: "Ada" })).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "filter.checked_in" }))
    await waitFor(() => expect(new URLSearchParams(window.location.search).get("attendee")).toBeNull())

    await user.click(screen.getByRole("button", { name: "filter.all" }))
    await screen.findByRole("button", { name: "table.open_row(name=Ada)" })
    expect(screen.queryByRole("dialog", { name: "Ada" })).toBeNull()
  })

  it("clears the bulk selection when the status tab changes", async () => {
    const user = userEvent.setup()
    renderAttendees([registration()])
    await user.click(await screen.findByRole("checkbox", { name: "table.select_row(name=Ada)" }))
    expect(screen.getByRole("button", { name: /bulk\.remove/ })).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "filter.registered" }))
    await waitFor(() => expect(screen.queryByRole("button", { name: /bulk\.remove/ })).toBeNull())
  })

  it("checks in every pending seat with one summary toast", async () => {
    const user = userEvent.setup()
    const client = renderAttendees([registration()])
    await user.click(await screen.findByRole("button", { name: "table.open_row(name=Ada)" }))
    await user.click(await screen.findByRole("button", { name: "drawer.check_in_all(count=2)" }))
    await waitFor(() => expect(client.checkInEventSeat).toHaveBeenCalledTimes(2))
    expect(await screen.findAllByText("bulk.checked_in(count=2)")).not.toHaveLength(0)
    expect(screen.queryByText("drawer.checked_in")).toBeNull()
  })

  it("shows registration times in the event's zone and names an empty ticket type", async () => {
    renderAttendees([registration()])
    const eventZoneTime = new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Los_Angeles",
    }).format(new Date("2026-09-12T17:00:00.000Z"))
    expect(await screen.findAllByText(eventZoneTime)).not.toHaveLength(0)
    expect(screen.getAllByText("state.no_value").length).toBeGreaterThan(0)
  })

  it("heads the waitlist's party column with a real label", async () => {
    window.history.replaceState(null, "", `/manage/events/${EVENT_ID}/attendees/?status=waitlisted`)
    renderAttendees([registration()])
    expect(await screen.findAllByText("drawer.party")).not.toHaveLength(0)
    expect(screen.queryByText("column.party")).toBeNull()
  })
})
