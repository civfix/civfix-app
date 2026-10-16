import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient } from "@tanstack/react-query"
import type { BroadcastDTO, CleanupDTO } from "@civfix/contract"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { ConsoleTestHarness } from "@/components/console/__testing__/harness"
import type { ConsoleRoute } from "@/components/console/route"
import { ConsoleEventProvider, ConsoleNavigationProvider } from "../console-context"
import { consoleKeys } from "../console-keys"
import { BroadcastsRouter } from "./broadcasts-router"

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

function renderRouter(route: ConsoleRoute, api: Record<string, unknown>) {
  // Seeded entries have no observer, so they must outlive the harness's zero gcTime.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
  render(
    <ConsoleTestHarness client={queryClient} options={{ api: api as never }}>
      <ConsoleNavigationProvider>
        <ConsoleEventProvider eventId={EVENT_ID} event={EVENT}>
          <BroadcastsRouter route={route} />
        </ConsoleEventProvider>
      </ConsoleNavigationProvider>
    </ConsoleTestHarness>,
  )
  return queryClient
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe("BroadcastsRouter detail", () => {
  it("shows the saved broadcast in the composer after a save", async () => {
    window.history.replaceState(null, "", `/manage/events/${EVENT_ID}/broadcasts/${BROADCAST_ID}/`)
    const user = userEvent.setup()
    const saved = broadcast({
      subject: "Bring gloves and water",
      updatedAt: "2026-09-02T00:00:00.000Z",
    })
    const api = {
      getEventBroadcast: vi.fn().mockResolvedValue(broadcast()),
      updateEventBroadcast: vi.fn().mockResolvedValue(saved),
      listEventTicketTypes: vi.fn().mockResolvedValue({ items: [] }),
    }
    renderRouter({ kind: "broadcast", eventId: EVENT_ID, broadcastId: BROADCAST_ID }, api)

    await user.type(await screen.findByLabelText("composer.subject"), " and water")
    await user.click(screen.getByRole("button", { name: "action.save" }))
    await waitFor(() => expect(api.updateEventBroadcast).toHaveBeenCalledTimes(1))

    await waitFor(() =>
      expect(screen.getByLabelText("composer.subject")).toHaveProperty(
        "value",
        "Bring gloves and water",
      ),
    )
    expect(screen.getByRole("button", { name: "composer.send" })).toHaveProperty("disabled", false)
  })
})

describe("BroadcastsRouter list", () => {
  it("invalidates every cached broadcast list and detail after a cancel", async () => {
    window.history.replaceState(null, "", `/manage/events/${EVENT_ID}/broadcasts/`)
    const user = userEvent.setup()
    const scheduled = broadcast({ status: "scheduled", scheduledAt: "2026-09-19T15:30:00.000Z" })
    const api = {
      listEventBroadcasts: vi.fn().mockResolvedValue({ items: [scheduled], nextCursor: null }),
      cancelEventBroadcast: vi.fn().mockResolvedValue({ ...scheduled, status: "cancelled" }),
    }
    const queryClient = renderRouter({ kind: "broadcasts", eventId: EVENT_ID }, api)
    const scheduledList = [...consoleKeys.broadcastsRoot(EVENT_ID), "scheduled"]
    const detail = consoleKeys.broadcast(EVENT_ID, BROADCAST_ID)
    queryClient.setQueryData(scheduledList, { pages: [], pageParams: [] })
    queryClient.setQueryData(detail, scheduled)

    await user.click(await screen.findByRole("button", { name: "action.cancel" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "cancel_confirm.confirm" }))
    await waitFor(() => expect(api.cancelEventBroadcast).toHaveBeenCalledTimes(1))

    await waitFor(() => expect(queryClient.getQueryState(scheduledList)?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(detail)?.isInvalidated).toBe(true)
  })
})
