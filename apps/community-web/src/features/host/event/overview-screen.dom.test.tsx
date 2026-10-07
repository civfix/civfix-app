import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"
import type { CleanupDTO } from "@civfix/shared"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "@/components/console/__testing__/harness"
import { ConsoleEventProvider } from "../console-context"
import { OverviewScreen } from "./overview-screen"

const EVENT_ID = "33333333-3333-4333-8333-333333333333"

function renderOverview(over: Partial<CleanupDTO>) {
  const event = {
    id: EVENT_ID,
    title: "River day",
    scheduledAt: "2026-09-20T17:00:00.000Z",
    endsAt: null,
    timezone: null,
    address: null,
    registrationOpensAt: null,
    registrationClosesAt: null,
    myCapabilities: [],
    ...over,
  } as unknown as CleanupDTO
  const pending = () => new Promise(() => {})
  renderConsole(
    <ConsoleEventProvider eventId={EVENT_ID} event={event}>
      <OverviewScreen />
    </ConsoleEventProvider>,
    {
      api: new Proxy({}, { get: () => vi.fn().mockImplementation(pending) }) as never,
    },
  )
}

afterEach(() => {
  cleanup()
})

describe("OverviewScreen details", () => {
  it("joins the event's start and end through a translatable range, not a bare en dash", () => {
    renderOverview({ endsAt: "2026-09-20T19:00:00.000Z" })
    const when = screen.getByText(/details\.when_range\(/)
    expect(when.textContent).not.toContain("–")
  })

  it("joins the registration window through translatable copy, not a bare arrow", () => {
    renderOverview({
      registrationOpensAt: "2026-09-12T17:00:00.000Z",
      registrationClosesAt: "2026-09-19T17:00:00.000Z",
    })
    const window = screen.getByText(/details\.registration_range\(/)
    expect(window.textContent).not.toContain("→")
  })

  it("says the window is open now until it closes when no opening time was set", () => {
    renderOverview({ registrationClosesAt: "2026-09-19T17:00:00.000Z" })
    const window = screen.getByText(/details\.registration_open_until\(/)
    expect(window.textContent).not.toContain("→")
  })
})
