import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { CleanupDTO, EventQuestionDTO, TicketTypeDTO } from "@civfix/shared"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return { ...makeI18nMock(), useViewerTimeZone: () => "America/New_York" }
})

import { renderConsole } from "@/components/console/__testing__/harness"
import { ConsoleEventProvider } from "../console-context"
import { TicketsScreen } from "./tickets-screen"

const EVENT_ID = "33333333-3333-4333-8333-333333333333"

const EVENT = {
  id: EVENT_ID,
  timezone: "America/Los_Angeles",
  scheduledAt: "2026-09-20T17:00:00.000Z",
  myCapabilities: [],
} as unknown as CleanupDTO

function ticketType(over: Partial<TicketTypeDTO> = {}): TicketTypeDTO {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    cleanupId: EVENT_ID,
    name: "Volunteer",
    description: null,
    capacity: null,
    reserved: 0,
    sold: 0,
    salesOpensAt: "2026-09-12T17:00:00.000Z",
    salesClosesAt: null,
    visibility: "public",
    accessCodeSet: false,
    maxPartySize: 1,
    sortOrder: 0,
    questionIds: [],
    soldOut: false,
    salesOpen: true,
    waitlistEnabled: false,
    ...over,
  }
}

function renderTickets(types: TicketTypeDTO[], questions: EventQuestionDTO[] = []) {
  const client = {
    listEventTicketTypes: vi.fn().mockResolvedValue({ items: types }),
    listEventQuestions: vi.fn().mockResolvedValue({ items: questions }),
    saveEventQuestions: vi.fn().mockResolvedValue({ items: questions }),
    updateEventTicketType: vi.fn().mockResolvedValue(types[0]),
    createEventTicketType: vi.fn(),
  }
  renderConsole(
    <ConsoleEventProvider eventId={EVENT_ID} event={EVENT}>
      <TicketsScreen />
    </ConsoleEventProvider>,
    { api: client as never },
  )
  return client
}

// The first render in a file pays for the console's lazy module graph, which can outlast the
// default one-second find window on a cold worker.
const findEdit = () =>
  screen.findByRole("button", { name: "types.edit_a11y(name=Volunteer)" }, { timeout: 3000 })

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, "", `/manage/events/${EVENT_ID}/tickets/`)
})

afterEach(() => {
  cleanup()
})

describe("TicketTypeDrawer sales window", () => {
  it("shows sales times in the event's zone and keeps them when only the name changes", async () => {
    const user = userEvent.setup()
    const client = renderTickets([ticketType()])
    await user.click(await findEdit())
    expect(screen.getByLabelText(/field\.sales_opens/)).toHaveProperty("value", "2026-09-12T10:00")

    await user.type(screen.getByLabelText("field.name"), "s")
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "action.save" }))
    await waitFor(() => expect(client.updateEventTicketType).toHaveBeenCalledTimes(1))
    const body = client.updateEventTicketType.mock.calls[0]![0] as Record<string, unknown>
    expect(body.name).toBe("Volunteers")
    expect(body).not.toHaveProperty("salesOpensAt")
    expect(body).not.toHaveProperty("salesClosesAt")
  })

  it("converts an edited sales time from the event's zone", async () => {
    const user = userEvent.setup()
    const client = renderTickets([ticketType()])
    await user.click(await findEdit())
    const closes = screen.getByLabelText(/field\.sales_closes/)
    await user.type(closes, "2026-09-20T09:00")
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "action.save" }))
    await waitFor(() => expect(client.updateEventTicketType).toHaveBeenCalledTimes(1))
    const body = client.updateEventTicketType.mock.calls[0]![0] as Record<string, unknown>
    expect(body.salesClosesAt).toBe("2026-09-20T16:00:00.000Z")
    expect(body).not.toHaveProperty("salesOpensAt")
  })
})

describe("TicketsScreen drawer lifecycle", () => {
  it("starts a fresh drawer each time, without the last one's submit errors", async () => {
    const user = userEvent.setup()
    renderTickets([ticketType()])
    await user.click(await findEdit())
    await user.clear(screen.getByLabelText("field.name"))
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "action.save" }))
    expect(screen.getByText("form.error_summary_title")).toBeTruthy()
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "action.cancel" }))

    await user.click(screen.getAllByRole("button", { name: "types.add" })[0]!)
    expect(screen.getByLabelText("field.name")).toHaveProperty("value", "")
    expect(screen.queryByText("form.error_summary_title")).toBeNull()
  })

  it("names the ticket type in each row action", async () => {
    renderTickets([ticketType()])
    expect(await screen.findByRole("button", { name: "types.delete_named(name=Volunteer)" }))
      .toBeTruthy()
    expect(screen.getByRole("button", { name: "types.move_up_named(name=Volunteer)" })).toBeTruthy()
  })
})

describe("QuestionsEditor", () => {
  const QUESTION: EventQuestionDTO = {
    id: "77777777-7777-4777-8777-777777777777",
    cleanupId: EVENT_ID,
    kind: "multi_select",
    prompt: "Shirt size",
    helpText: null,
    required: false,
    ticketTypeId: null,
    options: [
      { value: "tshirt_s", label: "Small" },
      { value: "tshirt_m", label: "Medium" },
    ],
    maxSelections: 1,
    consentText: null,
    showIf: { questionId: "88888888-8888-4888-8888-888888888888", equals: "yes" },
    sortOrder: 0,
  }
  const CONDITION_TARGET: EventQuestionDTO = {
    ...QUESTION,
    id: "88888888-8888-4888-8888-888888888888",
    kind: "checkbox",
    prompt: "Need a shirt?",
    options: [],
    maxSelections: null,
    showIf: null,
    sortOrder: 1,
  }

  it("saves a question without rewriting its option values, condition or limit", async () => {
    const user = userEvent.setup()
    const client = renderTickets([], [QUESTION, CONDITION_TARGET])
    await screen.findAllByLabelText("questions.prompt", {}, { timeout: 3000 })
    await user.click(screen.getByRole("button", { name: "action.save" }))
    await waitFor(() => expect(client.saveEventQuestions).toHaveBeenCalledTimes(1))
    const [saved] = (client.saveEventQuestions.mock.calls[0]![0] as { questions: unknown[] })
      .questions
    expect(saved).toMatchObject({
      options: QUESTION.options,
      maxSelections: 1,
      showIf: QUESTION.showIf,
    })
  })

  it("names the question in each row action", async () => {
    renderTickets([], [QUESTION])
    expect(
      await screen.findByRole(
        "button",
        { name: "questions.remove_named(name=Shirt size)" },
        { timeout: 3000 },
      ),
    ).toBeTruthy()
  })
})
