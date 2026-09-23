import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { BroadcastDTO, CleanupDTO } from "@civfix/shared"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return { ...makeI18nMock(), useViewerTimeZone: () => "America/New_York" }
})

import { renderConsole } from "@/components/console/__testing__/harness"
import { ConsoleEventProvider, ConsoleNavigationProvider } from "../console-context"
import { BroadcastComposer } from "./broadcast-composer"

const EVENT_ID = "33333333-3333-4333-8333-333333333333"
const BROADCAST_ID = "66666666-6666-4666-8666-666666666666"

const EVENT = {
  id: EVENT_ID,
  timezone: "America/Los_Angeles",
  scheduledAt: "2026-09-20T17:00:00.000Z",
  slots: [],
  myCapabilities: [],
} as unknown as CleanupDTO

function broadcast(over: Partial<BroadcastDTO> = {}): BroadcastDTO {
  return {
    id: BROADCAST_ID,
    cleanupId: EVENT_ID,
    kind: "manual",
    status: "draft",
    subject: "Bring gloves",
    bodyMd: "See you Saturday.",
    segment: { kind: "all_registered" },
    channels: ["inapp", "push"],
    scheduledAt: null,
    recipientCount: 0,
    sentCount: 0,
    failedCount: 0,
    suppressedCount: 0,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: null,
    ...over,
  } as BroadcastDTO
}

function renderComposer(dto: BroadcastDTO) {
  const client = {
    listEventTicketTypes: vi.fn().mockResolvedValue({ items: [] }),
    scheduleEventBroadcast: vi.fn().mockResolvedValue(dto),
    sendEventBroadcast: vi.fn().mockResolvedValue(dto),
    testSendEventBroadcast: vi.fn().mockResolvedValue({ ok: true }),
  }
  renderConsole(
    <ConsoleNavigationProvider>
      <ConsoleEventProvider eventId={EVENT_ID} event={EVENT}>
        <BroadcastComposer broadcast={dto} />
      </ConsoleEventProvider>
    </ConsoleNavigationProvider>,
    { api: client as never },
  )
  return client
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, "", `/manage/events/${EVENT_ID}/broadcasts/${BROADCAST_ID}/`)
})

afterEach(() => {
  cleanup()
})

describe("BroadcastComposer schedule", () => {
  it("shows the scheduled time in the event's zone and re-schedules it unchanged", async () => {
    const user = userEvent.setup()
    const client = renderComposer(
      broadcast({ status: "scheduled", scheduledAt: "2026-09-12T17:00:00.000Z" }),
    )
    expect(screen.getByLabelText(/composer\.schedule_at/)).toHaveProperty(
      "value",
      "2026-09-12T10:00",
    )
    await user.click(screen.getByRole("button", { name: "composer.schedule_action" }))
    await waitFor(() => expect(client.scheduleEventBroadcast).toHaveBeenCalledTimes(1))
    expect(client.scheduleEventBroadcast.mock.calls[0]![0]).toMatchObject({
      scheduledAt: "2026-09-12T17:00:00.000Z",
    })
  })

  it("schedules an edited time in the event's zone", async () => {
    const user = userEvent.setup()
    const client = renderComposer(broadcast())
    await user.type(screen.getByLabelText(/composer\.schedule_at/), "2026-09-19T08:30")
    await user.click(screen.getByRole("button", { name: "composer.schedule_action" }))
    await waitFor(() => expect(client.scheduleEventBroadcast).toHaveBeenCalledTimes(1))
    expect(client.scheduleEventBroadcast.mock.calls[0]![0]).toMatchObject({
      scheduledAt: "2026-09-19T15:30:00.000Z",
    })
  })
})

describe("BroadcastComposer unsaved edits", () => {
  it("blocks send, test send and schedule until an edited message is saved", async () => {
    const user = userEvent.setup()
    renderComposer(broadcast())
    const send = screen.getByRole("button", { name: "composer.send" })
    expect(send).toHaveProperty("disabled", false)

    await user.type(screen.getByLabelText("composer.subject"), " and water")
    expect(send).toHaveProperty("disabled", true)
    expect(screen.getByRole("button", { name: "composer.test_send" })).toHaveProperty(
      "disabled",
      true,
    )
    expect(screen.getByRole("button", { name: "composer.schedule_action" })).toHaveProperty(
      "disabled",
      true,
    )
    expect(screen.getByText("composer.save_before_send").getAttribute("role")).toBe("status")
  })

  it("does not count a schedule time edit as an unsaved message", async () => {
    const user = userEvent.setup()
    renderComposer(broadcast())
    await user.type(screen.getByLabelText(/composer\.schedule_at/), "2026-09-19T08:30")
    expect(screen.getByRole("button", { name: "composer.send" })).toHaveProperty("disabled", false)
    expect(screen.getByRole("button", { name: "composer.schedule_action" })).toHaveProperty(
      "disabled",
      false,
    )
  })
})
