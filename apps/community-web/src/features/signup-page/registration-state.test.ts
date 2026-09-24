import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { EventQuestionDTO, PublicEventPageDTO } from "@civfix/shared"

import {
  answerIsBlank,
  answerPayload,
  clampPartySize,
  defaultTicketId,
  isSuccessOutcome,
  missingRequired,
  outcomeMessageKey,
  questionVisible,
  questionsFor,
  registrationWindowState,
  selectableTickets,
  waitlistAvailable,
} from "./registration-state"
import { signupPage, ticket } from "./__fixtures__"

const NOW = Date.parse("2026-05-01T12:00:00.000Z")

function page(overrides: Partial<PublicEventPageDTO> = {}): PublicEventPageDTO {
  return signupPage("2026-05-10T17:00:00.000Z", overrides)
}

function question(overrides: Partial<EventQuestionDTO> = {}): EventQuestionDTO {
  return {
    id: "q1",
    cleanupId: "evt_1",
    kind: "short_text",
    prompt: "What should we know?",
    required: false,
    options: [],
    sortOrder: 0,
    ...overrides,
  } as EventQuestionDTO
}

describe("registrationWindowState", () => {
  it("is open by default", () => {
    expect(registrationWindowState(page(), NOW)).toBe("open")
  })

  it("reports a cancelled event before anything else", () => {
    expect(
      registrationWindowState(page({ event: { ...page().event, status: "cancelled" } }), NOW),
    ).toBe("cancelled")
  })

  it("reports a finished event as closed, reading the END TIME rather than the stored status", () => {
    const over = page({
      event: {
        ...page().event,
        startsAt: "2026-04-30T17:00:00.000Z",
        endsAt: "2026-04-30T21:00:00.000Z",
      },
    })
    expect(registrationWindowState(over, NOW)).toBe("closed")
    const stale = page({ event: { ...page().event, status: "done" } })
    expect(registrationWindowState(stale, NOW)).toBe("open")
  })

  it("honors the registration window in both directions", () => {
    const notYet = page({
      event: { ...page().event, registrationOpensAt: "2026-06-01T00:00:00.000Z" },
    })
    expect(registrationWindowState(notYet, NOW)).toBe("not_yet_open")
    const closed = page({
      event: { ...page().event, registrationClosesAt: "2026-04-01T00:00:00.000Z" },
    })
    expect(registrationWindowState(closed, NOW)).toBe("closed")
  })

  it("is sold out only when every sellable ticket is sold out", () => {
    expect(
      registrationWindowState(page({ ticketTypes: [ticket({ soldOut: true })] }), NOW),
    ).toBe("sold_out")
    expect(
      registrationWindowState(
        page({ ticketTypes: [ticket({ soldOut: true }), ticket({ id: "t2" })] }),
        NOW,
      ),
    ).toBe("open")
  })

  it("is closed, not sold out, when sales are shut on every ticket", () => {
    expect(
      registrationWindowState(page({ ticketTypes: [ticket({ salesOpen: false })] }), NOW),
    ).toBe("closed")
  })
})

describe("ticket selection", () => {
  it("orders by sortOrder then name and prefers an available ticket", () => {
    const world = page({
      ticketTypes: [
        ticket({ id: "t2", name: "B", sortOrder: 1 }),
        ticket({ id: "t1", name: "A", sortOrder: 0, soldOut: true }),
      ],
    })
    expect(selectableTickets(world).map((entry) => entry.id)).toEqual(["t1", "t2"])
    expect(defaultTicketId(world)).toBe("t2")
  })

  it("falls back to the page waitlist flag when there are no ticket types", () => {
    expect(waitlistAvailable(null, page({ waitlistEnabled: true }))).toBe(true)
    expect(waitlistAvailable(ticket({ waitlistEnabled: false }), page({ waitlistEnabled: true }))).toBe(
      false,
    )
  })
})

describe("questions", () => {
  it("keeps global questions and this ticket's questions, and drops archived ones", () => {
    const questions = [
      question({ id: "q1" }),
      question({ id: "q2", ticketTypeId: "t1" }),
      question({ id: "q3", ticketTypeId: "t2" }),
      question({ id: "q4", archivedAt: "2026-01-01T00:00:00.000Z" }),
    ]
    expect(questionsFor(questions, "t1").map((entry) => entry.id)).toEqual(["q1", "q2"])
  })

  it("hides a conditional question until its trigger is answered", () => {
    const conditional = question({ id: "q2", showIf: { questionId: "q1", equals: "yes" } })
    expect(questionVisible(conditional, {})).toBe(false)
    expect(questionVisible(conditional, { q1: "no" })).toBe(false)
    expect(questionVisible(conditional, { q1: "yes" })).toBe(true)
    expect(questionVisible(conditional, { q1: ["yes", "maybe"] })).toBe(true)
  })

  it("never demands an answer to a hidden required question", () => {
    const questions = [
      question({ id: "q1" }),
      question({ id: "q2", required: true, showIf: { questionId: "q1", equals: "yes" } }),
    ]
    expect(missingRequired(questions, {}, null)).toEqual([])
    expect(missingRequired(questions, { q1: "yes" }, null)).toEqual(["q2"])
    expect(missingRequired(questions, { q1: "yes", q2: "answer" }, null)).toEqual([])
  })

  it("never demands, nor submits, a question belonging to a DIFFERENT ticket type", () => {
    const questions = [
      question({ id: "shared" }),
      question({ id: "forA", ticketTypeId: "tA", required: true }),
      question({ id: "forB", ticketTypeId: "tB", required: true }),
    ]
    expect(missingRequired(questions, { shared: "x", forA: "a" }, "tA")).toEqual([])
    expect(missingRequired(questions, { shared: "x" }, "tA")).toEqual(["forA"])
    expect(answerPayload(questions, { shared: "x", forA: "a", forB: "stale" }, "tA")).toEqual([
      { questionId: "shared", value: "x" },
      { questionId: "forA", value: "a" },
    ])
  })

  it("treats an unticked consent box as blank", () => {
    expect(answerIsBlank(false)).toBe(true)
    expect(answerIsBlank(true)).toBe(false)
    expect(answerIsBlank("   ")).toBe(true)
    expect(answerIsBlank([])).toBe(true)
    expect(answerIsBlank(undefined)).toBe(true)
  })

  it("sends only visible, answered questions", () => {
    const questions = [
      question({ id: "q1" }),
      question({ id: "q2", showIf: { questionId: "q1", equals: "yes" } }),
    ]
    expect(answerPayload(questions, { q1: "yes", q2: "detail" }, null)).toEqual([
      { questionId: "q1", value: "yes" },
      { questionId: "q2", value: "detail" },
    ])
    expect(answerPayload(questions, { q1: "no", q2: "stale" }, null)).toEqual([
      { questionId: "q1", value: "no" },
    ])
  })
})

describe("party size and outcomes", () => {
  it("clamps into the ticket's own bound", () => {
    expect(clampPartySize(0, 4)).toBe(1)
    expect(clampPartySize(9, 4)).toBe(4)
    expect(clampPartySize(Number.NaN, 4)).toBe(1)
    expect(clampPartySize(2.7, 4)).toBe(2)
  })

  it("has a message for every register outcome", () => {
    const outcomes = [
      "registered",
      "replayed",
      "already_registered",
      "waitlisted",
      "full",
      "party_too_large",
      "sales_closed",
      "registration_closed",
      "ticket_type_not_found",
      "access_code_required",
      "access_code_invalid",
      "answers_invalid",
      "banned",
      "closed",
      "not_found",
    ] as const
    for (const outcome of outcomes) {
      expect(outcomeMessageKey(outcome)).toMatch(/^(web-signup|host-ticket):outcome\.[a-z_]+$/)
    }
  })

  it("reuses host-ticket refusal copy that exists in the en catalog, so no outcome renders English in every locale", () => {
    const catalog = JSON.parse(
      readFileSync(
        new URL("../../../../../packages/ui/src/i18n/locales/en/host-ticket.json", import.meta.url),
        "utf8",
      ),
    ) as { outcome: Record<string, string> }
    const refusals = [
      "already_registered",
      "full",
      "party_too_large",
      "sales_closed",
      "registration_closed",
      "ticket_type_not_found",
      "access_code_required",
      "access_code_invalid",
      "answers_invalid",
      "banned",
      "closed",
      "not_found",
    ] as const
    for (const outcome of refusals) {
      const key = outcomeMessageKey(outcome)
      expect(key).toBe(`host-ticket:outcome.${outcome}`)
      expect(catalog.outcome[outcome], outcome).toBeTruthy()
    }
  })

  it("treats a replay and an existing registration as success, never as an error", () => {
    expect(isSuccessOutcome("registered")).toBe(true)
    expect(isSuccessOutcome("replayed")).toBe(true)
    expect(isSuccessOutcome("already_registered")).toBe(true)
    expect(isSuccessOutcome("waitlisted")).toBe(false)
    expect(isSuccessOutcome("full")).toBe(false)
  })
})
