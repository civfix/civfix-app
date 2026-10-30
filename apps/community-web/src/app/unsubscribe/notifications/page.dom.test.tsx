import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { I18nProvider } from "@civfix/ui/i18n"

const unsubscribeNotificationEmail = vi.fn<(...args: unknown[]) => Promise<unknown>>()

vi.mock("@/lib/api", () => ({
  api: {
    unsubscribeNotificationEmail: (...args: unknown[]) => unsubscribeNotificationEmail(...args),
  },
}))

const { default: NotificationUnsubscribePage } = await import("./page")

const TOKEN = `n1.${"t".repeat(40)}`
const DONE = "You won't get emails about Events you're going to anymore."
const UNUSABLE = "This link didn't work. You can change emails in notification settings."

function renderAt(search: string, { strict = false } = {}) {
  window.history.replaceState(null, "", `/unsubscribe/notifications/${search}`)
  const page = (
    <I18nProvider locale="en">
      <NotificationUnsubscribePage />
    </I18nProvider>
  )
  render(strict ? <React.StrictMode>{page}</React.StrictMode> : page)
}

function expectSettingsLink() {
  const link = screen.getByRole("link", { name: "Manage notification settings" })
  expect(link.getAttribute("href")).toBe("/notifications/prefs")
}

beforeEach(() => {
  unsubscribeNotificationEmail.mockReset().mockResolvedValue({ ok: true, category: "events" })
})

afterEach(() => {
  cleanup()
})

describe("GH#223 /unsubscribe/notifications/", () => {
  it("T19: POSTs the token once under StrictMode, then names the category", async () => {
    renderAt(`?t=${TOKEN}`, { strict: true })
    expect((await screen.findByRole("heading")).textContent).toBe(DONE)
    expect(unsubscribeNotificationEmail).toHaveBeenCalledTimes(1)
    expect(unsubscribeNotificationEmail).toHaveBeenCalledWith({ token: TOKEN })
    expectSettingsLink()
  })

  it("T20: a null category reads as a link that didn't work", async () => {
    unsubscribeNotificationEmail.mockResolvedValue({ ok: true, category: null })
    renderAt(`?t=${TOKEN}`)
    expect((await screen.findByRole("heading")).textContent).toBe(UNUSABLE)
    expectSettingsLink()
  })

  it("T21: no token sends nothing and reads as a link that didn't work", async () => {
    renderAt("")
    expect((await screen.findByRole("heading")).textContent).toBe(UNUSABLE)
    expect(unsubscribeNotificationEmail).not.toHaveBeenCalled()
    expectSettingsLink()
  })

  it("T22: a failed request reads as a link that didn't work", async () => {
    unsubscribeNotificationEmail.mockRejectedValue(
      Object.assign(new Error("Service Unavailable"), { status: 503 }),
    )
    renderAt(`?t=${TOKEN}`)
    expect((await screen.findByRole("heading")).textContent).toBe(UNUSABLE)
    expectSettingsLink()
  })

  it("T23: shows that it is checking the link until the request settles", () => {
    unsubscribeNotificationEmail.mockReturnValue(new Promise(() => {}))
    renderAt(`?t=${TOKEN}`)
    expect(screen.getByRole("status", { name: "Checking your link" })).toBeTruthy()
    expect(screen.queryByText(DONE)).toBeNull()
    expect(screen.queryByText(UNUSABLE)).toBeNull()
    expect(screen.queryByRole("heading")).toBeNull()
  })
})
