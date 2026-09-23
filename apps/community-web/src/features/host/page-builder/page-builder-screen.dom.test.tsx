import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { CleanupDTO, EventPageBlock, EventPageDTO } from "@civfix/shared"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "@/components/console/__testing__/harness"
import { ConsoleEventProvider } from "../console-context"
import { PageBuilderScreen } from "./page-builder-screen"

const EVENT_ID = "33333333-3333-4333-8333-333333333333"
const EVENT = { id: EVENT_ID, title: "River day", myCapabilities: [] } as unknown as CleanupDTO

function page(over: Partial<EventPageDTO> = {}): EventPageDTO {
  return {
    cleanupId: EVENT_ID,
    slug: null,
    status: "draft",
    theme: { accent: "bloom" },
    coverMediaId: null,
    coverUrl: null,
    blocks: [{ id: "about-1", kind: "about", body: "Hello" }],
    seo: { noindex: false },
    ...over,
  } as EventPageDTO
}

function renderBuilder(dto: EventPageDTO) {
  const client = {
    getEventPage: vi.fn().mockResolvedValue(dto),
    saveEventPage: vi
      .fn()
      .mockImplementation(async (body: { slug: string | null; blocks: EventPageBlock[] }) => ({
        ...dto,
        slug: body.slug,
        blocks: body.blocks,
      })),
    publishEventPage: vi.fn().mockResolvedValue({ ...dto, status: "published" }),
    checkEventPageSlug: vi.fn().mockResolvedValue({ available: true }),
  }
  renderConsole(
    <ConsoleEventProvider eventId={EVENT_ID} event={EVENT}>
      <PageBuilderScreen />
    </ConsoleEventProvider>,
    { api: client as never },
  )
  return client
}

beforeEach(() => {
  window.history.replaceState(null, "", `/manage/events/${EVENT_ID}/page/`)
})

afterEach(() => {
  cleanup()
})

describe("PageBuilderScreen publish", () => {
  it("saves unsaved edits before publishing, so what goes live is what the host sees", async () => {
    const user = userEvent.setup()
    const client = renderBuilder(page())
    await user.type(await screen.findByLabelText("slug.label"), "river-day")
    await user.click(screen.getByRole("button", { name: "publish" }))
    await waitFor(() => expect(client.publishEventPage).toHaveBeenCalledTimes(1))
    expect(client.saveEventPage).toHaveBeenCalledTimes(1)
    expect(client.saveEventPage.mock.calls[0]![0]).toMatchObject({ slug: "river-day" })
    expect(client.saveEventPage.mock.invocationCallOrder[0]!).toBeLessThan(
      client.publishEventPage.mock.invocationCallOrder[0]!,
    )
  })

  it("publishes a saved page directly", async () => {
    const user = userEvent.setup()
    const client = renderBuilder(page({ slug: "river-day" }))
    await screen.findByLabelText("slug.label")
    await user.click(screen.getByRole("button", { name: "publish" }))
    await waitFor(() => expect(client.publishEventPage).toHaveBeenCalledTimes(1))
    expect(client.saveEventPage).not.toHaveBeenCalled()
  })
})

describe("PageBuilderScreen blocks", () => {
  it("shows a blank-row error at its field instead of sending an invalid save", async () => {
    const user = userEvent.setup()
    const client = renderBuilder(
      page({
        slug: "river-day",
        blocks: [{ id: "faq-1", kind: "faq", items: [{ question: "Parking?", answer: "" }] }],
      }),
    )
    await screen.findByLabelText("slug.label")
    await user.click(screen.getByRole("button", { name: "action.save" }))
    expect(await screen.findByText("block.error.required")).toBeTruthy()
    expect(client.saveEventPage).not.toHaveBeenCalled()
  })

  it("names the block and the row in every row action", async () => {
    renderBuilder(
      page({ blocks: [{ id: "hosts-1", kind: "hosts", entries: [{ name: "Rosa" }] }] }),
    )
    expect(
      await screen.findByRole("button", {
        name: "blocks.remove_named(name=blocks.item_name(kind=block.kind.hosts,n=1))",
      }),
    ).toBeTruthy()
    expect(
      screen.getByRole("button", {
        name: "block.remove_row(label=block.hosts.entry(n=1))",
      }),
    ).toBeTruthy()
    expect(screen.getByLabelText("block.hosts.name")).toHaveProperty("value", "Rosa")
  })
})
