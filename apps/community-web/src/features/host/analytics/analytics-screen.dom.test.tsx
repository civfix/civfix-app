import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor } from "@testing-library/react"
import type { CleanupDTO } from "@civfix/shared"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "@/components/console/__testing__/harness"
import { ConsoleEventProvider } from "../console-context"
import { AnalyticsScreen } from "./analytics-screen"

const EVENT_ID = "33333333-3333-4333-8333-333333333333"
const EVENT = { id: EVENT_ID, title: "River day", myCapabilities: [] } as unknown as CleanupDTO
const ENVELOPE = { generatedAt: "2026-09-12T17:00:00.000Z", k: 5 }
const RATE = { value: null, suppressed: true }
const PANEL = { rows: [], panelSuppressed: true }

const OVERVIEW = {
  ...ENVELOPE,
  kpis: {
    registered: 12,
    checkedIn: 8,
    waitlisted: 0,
    cancelled: 0,
    noShow: 0,
    capacity: null,
    pageViews: 40,
    donationClicks: null,
  },
  checkInRate: RATE,
  noShowRate: RATE,
  capacityUtilization: RATE,
  funnel: [],
}

function renderAnalytics(tab: string, tabApi: Record<string, unknown>) {
  window.history.replaceState(null, "", `/manage/events/${EVENT_ID}/analytics/?tab=${tab}`)
  const client = {
    eventAnalyticsOverview: vi.fn().mockResolvedValue(OVERVIEW),
    ...tabApi,
  }
  renderConsole(
    <ConsoleEventProvider eventId={EVENT_ID} event={EVENT}>
      <AnalyticsScreen />
    </ConsoleEventProvider>,
    { api: client as never },
  )
  return client
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function measureCharts() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 400,
    height: 200,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 400,
    bottom: 200,
    toJSON: () => ({}),
  })
}

describe("AnalyticsScreen", () => {
  it("labels the broadcast total as broadcasts, and each channel by name", async () => {
    measureCharts()
    renderAnalytics("messaging", {
      eventAnalyticsBroadcasts: vi.fn().mockResolvedValue({
        ...ENVELOPE,
        broadcastsSent: 3,
        recipients: 40,
        unsubscribes: 0,
        byChannel: [{ channel: "inapp", sent: 20, failed: 0, suppressed: 0 }],
        series: [],
      }),
    })
    expect(await screen.findByText("messaging.broadcasts_sent")).toBeTruthy()
    expect(screen.queryByText("messaging.active_days")).toBeNull()
    expect(screen.getAllByText("broadcastChannel.inapp").length).toBeGreaterThan(0)
    expect(screen.queryByText("inapp")).toBeNull()
  })

  it("keeps Export off until the tab's data has loaded", async () => {
    let resolve: (value: unknown) => void = () => {}
    renderAnalytics("messaging", {
      eventAnalyticsBroadcasts: vi.fn().mockReturnValue(new Promise((done) => (resolve = done))),
    })
    const exportButton = screen.getByRole("button", { name: "export_csv" })
    expect(exportButton).toHaveProperty("disabled", true)
    resolve({
      ...ENVELOPE,
      broadcastsSent: 0,
      recipients: 0,
      unsubscribes: 0,
      byChannel: [],
      series: [],
    })
    await waitFor(() => expect(exportButton).toHaveProperty("disabled", false))
  })

  it("says why arrival bins are missing when some are suppressed", async () => {
    renderAnalytics("attendance", {
      eventAnalyticsCheckins: vi.fn().mockResolvedValue({
        ...ENVELOPE,
        arrivals: [
          { day: "0", value: 7 },
          { day: "15", value: null, suppressed: true },
        ],
        checkInRate: { value: 0.5, suppressed: false },
        noShowRate: { value: 0.1, suppressed: false },
        byTicketType: PANEL,
        bySlot: PANEL,
      }),
    })
    await screen.findByText("attendance.arrivals_hint")
    // One note for the overview KPIs, one for the arrivals chart.
    expect(screen.getAllByText("suppressed.note(k=5)")).toHaveLength(2)
  })
})
