import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { CleanupDTO } from "@civfix/shared"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return { ...makeI18nMock(), useViewerTimeZone: () => "America/New_York" }
})

import { renderConsole } from "@/components/console/__testing__/harness"
import { ConsoleEventProvider, ConsoleNavigationProvider } from "../console-context"
import { SettingsScreen } from "./settings-screen"

const EVENT_ID = "33333333-3333-4333-8333-333333333333"

function event(over: Partial<CleanupDTO> = {}): CleanupDTO {
  return {
    id: EVENT_ID,
    scheduledAt: "2026-09-20T17:00:00.000Z",
    timezone: "America/Los_Angeles",
    visibility: "public",
    registrationOpensAt: "2026-09-12T17:00:00.000Z",
    registrationClosesAt: null,
    donationUrl: null,
    reminderOffsetsMinutes: [60],
    organization: null,
    status: "scheduled",
    myCapabilities: [],
    ...over,
  } as CleanupDTO
}

function renderSettings(dto: CleanupDTO) {
  const client = {
    updateCleanup: vi.fn().mockResolvedValue(dto),
    listMyOrganizations: vi.fn().mockResolvedValue({ items: [] }),
  }
  renderConsole(
    <ConsoleNavigationProvider>
      <ConsoleEventProvider eventId={EVENT_ID} event={dto}>
        <SettingsScreen />
      </ConsoleEventProvider>
    </ConsoleNavigationProvider>,
    { api: client as never },
  )
  return client
}

beforeEach(() => {
  window.history.replaceState(null, "", `/manage/events/${EVENT_ID}/settings/`)
})

afterEach(() => {
  cleanup()
})

describe("SettingsScreen registration window", () => {
  it("shows the window in the event's zone and names that zone", async () => {
    renderSettings(event())
    await waitFor(() =>
      expect(screen.getByLabelText(/registration\.opens/)).toHaveProperty(
        "value",
        "2026-09-12T10:00",
      ),
    )
    expect(screen.getByText("registration.zone_hint(zone=Pacific Time)")).toBeTruthy()
  })

  it("does not move an untouched window when another setting is saved", async () => {
    const user = userEvent.setup()
    const client = renderSettings(event())
    await waitFor(() =>
      expect(screen.getByLabelText(/registration\.opens/)).toHaveProperty(
        "value",
        "2026-09-12T10:00",
      ),
    )
    await user.click(screen.getByRole("button", { name: "action.save" }))
    await waitFor(() => expect(client.updateCleanup).toHaveBeenCalledTimes(1))
    const body = client.updateCleanup.mock.calls[0]![0] as Record<string, unknown>
    expect(body).not.toHaveProperty("registrationOpensAt")
    expect(body).not.toHaveProperty("registrationClosesAt")
  })
})

describe("SettingsScreen reminders", () => {
  it("caps the picks at the contract's maximum", async () => {
    renderSettings(event({ reminderOffsetsMinutes: [60, 180, 1440] }))
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /messaging\.offset_60/ })).toHaveProperty(
        "ariaPressed",
        "true",
      ),
    )
    expect(screen.getByRole("button", { name: "messaging.offset_2880" })).toHaveProperty(
      "disabled",
      true,
    )
    expect(screen.getByRole("button", { name: /messaging\.offset_60/ })).toHaveProperty(
      "disabled",
      false,
    )
  })
})
