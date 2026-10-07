import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "@/components/console/__testing__/harness"
import { ConsoleNavigationProvider } from "../console-context"
import { PortfolioScreen } from "./portfolio-screen"

const RATE = { value: null, suppressed: true }

function renderPortfolio() {
  const client = {
    listMyOrganizations: vi.fn().mockResolvedValue({ items: [] }),
    listMyHostedEvents: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    hostedEventsAnalytics: vi.fn().mockResolvedValue({
      generatedAt: "2026-09-12T17:00:00.000Z",
      range: "90d",
      k: 11,
      totals: { events: 3, registrations: null, checkIns: null, uniqueAttendees: null },
      series: [
        { day: "2026-09-01", value: 14 },
        { day: "2026-09-02", value: 20 },
        { day: "2026-09-03", value: null, suppressed: true },
      ],
      byEvent: { rows: [], panelSuppressed: true },
      repeatAttendance: RATE,
      averageCheckInRate: RATE,
      bestDayTime: null,
      topVolunteers: [],
    }),
  }
  renderConsole(
    <ConsoleNavigationProvider>
      <PortfolioScreen notFoundPath={null} />
    </ConsoleNavigationProvider>,
    { api: client as never },
  )
}

beforeEach(() => {
  window.history.replaceState(null, "", "/manage/")
})

afterEach(() => {
  cleanup()
})

describe("PortfolioScreen suppression", () => {
  it("explains suppressed totals with the threshold the server applied", async () => {
    renderPortfolio()
    expect(await screen.findByText("suppressed.note(k=11)")).toBeTruthy()
    expect(screen.getAllByLabelText("suppressed.explain(k=11)")).toHaveLength(3)
  })
})
