import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { CleanupDTO } from "@civfix/shared"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "@/components/console/__testing__/harness"
import { ConsoleEventProvider } from "../console-context"
import { CheckinScreen } from "./checkin-screen"

const EVENT_ID = "33333333-3333-4333-8333-333333333333"
const TYPE_ID = "55555555-5555-4555-8555-555555555555"
const EVENT = { id: EVENT_ID, myCapabilities: ["check_in"] } as unknown as CleanupDTO

beforeEach(() => {
  window.history.replaceState(null, "", `/manage/events/${EVENT_ID}/checkin/`)
})

afterEach(() => {
  cleanup()
})

describe("CheckinScreen walk-up", () => {
  it("starts the next walk-up without the last one's ticket type", async () => {
    const user = userEvent.setup()
    const client = {
      getEventCheckinCounters: vi.fn().mockRejectedValue(new Error("offline")),
      listEventTicketTypes: vi
        .fn()
        .mockResolvedValue({ items: [{ id: TYPE_ID, name: "Volunteer" }] }),
      listEventRegistrations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      createWalkupRegistration: vi.fn().mockResolvedValue({ outcome: "registered" }),
    }
    renderConsole(
      <ConsoleEventProvider eventId={EVENT_ID} event={EVENT}>
        <CheckinScreen />
      </ConsoleEventProvider>,
      { api: client as never },
    )

    await user.click(await screen.findByRole("button", { name: /walkup\.open/ }))
    let sheet = screen.getByRole("dialog")
    await user.type(within(sheet).getByLabelText("walkup.name"), "Ada")
    await waitFor(() => expect(within(sheet).getByRole("option", { name: "Volunteer" })).toBeTruthy())
    await user.selectOptions(within(sheet).getByLabelText(/walkup\.ticket_type/), TYPE_ID)
    await user.click(within(sheet).getByRole("button", { name: "walkup.submit" }))
    await waitFor(() => expect(client.createWalkupRegistration).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    await user.click(screen.getByRole("button", { name: /walkup\.open/ }))
    sheet = screen.getByRole("dialog")
    expect(within(sheet).getByLabelText(/walkup\.ticket_type/)).toHaveProperty("value", "")
  })
})
