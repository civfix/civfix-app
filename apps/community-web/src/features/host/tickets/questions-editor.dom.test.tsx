import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { EventQuestionDTO } from "@civfix/shared"
import { queryKeys } from "@civfix/ui/data"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { ConsoleTestHarness, makeTestQueryClient } from "@/components/console/__testing__/harness"
import { QuestionsEditor } from "./questions-editor"

const EVENT_ID = "33333333-3333-4333-8333-333333333333"

const QUESTION: EventQuestionDTO = {
  id: "88888888-8888-4888-8888-888888888888",
  cleanupId: EVENT_ID,
  kind: "checkbox",
  prompt: "Need a shirt?",
  helpText: null,
  required: false,
  ticketTypeId: null,
  options: [],
  maxSelections: null,
  consentText: null,
  showIf: null,
  sortOrder: 0,
}

function renderEditor(questions: EventQuestionDTO[]) {
  const qc = makeTestQueryClient()
  const client = { listEventQuestions: vi.fn().mockResolvedValue({ items: questions }) }
  render(
    <ConsoleTestHarness options={{ api: client as never }} client={qc}>
      <QuestionsEditor eventId={EVENT_ID} ticketTypes={[]} />
    </ConsoleTestHarness>,
  )
  return qc
}

afterEach(() => {
  cleanup()
})

describe("QuestionsEditor server refresh", () => {
  it("shows the refetched questions when the host has not edited anything", async () => {
    const qc = renderEditor([QUESTION])
    await waitFor(() =>
      expect(screen.getByLabelText("questions.prompt")).toHaveProperty("value", "Need a shirt?"),
    )
    act(() => {
      qc.setQueryData(queryKeys.hostQuestions(EVENT_ID), [{ ...QUESTION, prompt: "Need a T-shirt?" }])
    })
    await waitFor(() =>
      expect(screen.getByLabelText("questions.prompt")).toHaveProperty("value", "Need a T-shirt?"),
    )
  })

  it("keeps the host's unsaved edits when the server copy changes underneath them", async () => {
    const user = userEvent.setup()
    const qc = renderEditor([QUESTION])
    await waitFor(() =>
      expect(screen.getByLabelText("questions.prompt")).toHaveProperty("value", "Need a shirt?"),
    )
    await user.type(screen.getByLabelText("questions.prompt"), " Free")
    act(() => {
      qc.setQueryData(queryKeys.hostQuestions(EVENT_ID), [{ ...QUESTION, prompt: "Someone else" }])
    })
    expect(screen.getByLabelText("questions.prompt")).toHaveProperty("value", "Need a shirt? Free")
  })
})
