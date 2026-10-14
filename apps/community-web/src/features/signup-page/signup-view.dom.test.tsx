import { afterEach, describe, expect, it, vi } from "vitest"
import type * as ApiModule from "@/lib/api"
import { act, cleanup, render, screen } from "@testing-library/react"
import { AppError, ErrorCode } from "@civfix/shared"
import type { PublicEventPageDTO } from "@civfix/shared"

const getPublicEventPage = vi.fn<(...args: unknown[]) => unknown>()

vi.mock("@civfix/ui/i18n", () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
  Trans: ({ i18nKey }: { i18nKey: string }) => <>{i18nKey}</>,
}))
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  api: {
    getPublicEventPage: (...args: unknown[]) => getPublicEventPage(...args),
    recordEventPageView: async () => ({}),
  },
}))
vi.mock("./registration-widget", () => ({ RegistrationWidget: () => null }))

import { SignupView } from "./signup-view"

async function renderAt(path: string) {
  window.history.replaceState(null, "", path)
  await act(async () => {
    render(<SignupView />)
  })
}

afterEach(() => {
  cleanup()
  getPublicEventPage.mockReset()
})

describe("SignupView copy", () => {
  it("renders the not-found state from the catalog", async () => {
    getPublicEventPage.mockRejectedValue(new AppError(ErrorCode.NOT_FOUND, "gone"))
    await renderAt("/e/beach-cleanup/")
    expect(screen.getByRole("heading").textContent).toBe("state.not_found_title")
  })

  it("renders default section titles from the catalog and keeps a host's own title", async () => {
    getPublicEventPage.mockResolvedValue({
      slug: "beach-cleanup",
      theme: { accent: "bloom" },
      coverUrl: null,
      organization: null,
      event: { id: "evt_1", title: "Beach cleanup", startsAt: "2099-05-10T17:00:00.000Z" },
      blocks: [
        { id: "b1", kind: "about", title: null, body: "Bring gloves." },
        { id: "b2", kind: "faq", title: "Good to know", items: [{ question: "Q", answer: "A" }] },
      ],
      ticketTypes: [],
      questions: [],
    } as unknown as PublicEventPageDTO)
    await renderAt("/e/beach-cleanup/")
    expect(screen.getByRole("heading", { level: 2, name: "blocks.about" })).toBeTruthy()
    expect(screen.getByRole("heading", { level: 2, name: "Good to know" })).toBeTruthy()
    expect(screen.getByRole("button", { name: /calendar/ })).toBeTruthy()
  })
})
