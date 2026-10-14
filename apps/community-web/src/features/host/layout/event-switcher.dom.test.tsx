import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "@/components/console/__testing__/harness"
import { EventSwitcher } from "./event-switcher"

afterEach(() => {
  cleanup()
})

describe("EventSwitcher", () => {
  it("announces the dialog it opens, not a menu it does not have", async () => {
    const user = userEvent.setup()
    renderConsole(<EventSwitcher eventId="evt_1" section="overview" />, {
      api: { listMyHostedEvents: vi.fn().mockResolvedValue({ items: [], nextCursor: null }) } as never,
    })
    const trigger = screen.getByRole("button", { name: /switcher\.label/ })
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog")
    await user.click(trigger)
    expect(await screen.findByRole("dialog")).toBeTruthy()
  })
})
