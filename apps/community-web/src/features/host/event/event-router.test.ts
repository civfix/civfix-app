import { describe, expect, it, vi } from "vitest"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { noAccessExitRoute } from "./event-router"

const EVENT_ID = "33333333-3333-4333-8333-333333333333"

describe("noAccessExitRoute", () => {
  it("sends someone who cannot see the overview back to their events, not in a loop", () => {
    expect(noAccessExitRoute(false, EVENT_ID)).toEqual({ kind: "portfolio" })
  })

  it("sends someone who can see the overview there", () => {
    expect(noAccessExitRoute(true, EVENT_ID)).toEqual({
      kind: "event",
      eventId: EVENT_ID,
      section: "overview",
    })
  })
})
