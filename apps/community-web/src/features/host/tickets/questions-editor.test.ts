import { describe, expect, it } from "vitest"
import type { EventQuestionDTO } from "@civfix/shared"
import { EventQuestionDefSchema } from "@civfix/shared"

import { optionList, toDef, toDraft } from "./questions-editor"

const EVENT_ID = "33333333-3333-4333-8333-333333333333"
const QUESTION_ID = "77777777-7777-4777-8777-777777777777"
const OTHER_ID = "88888888-8888-4888-8888-888888888888"

const SIZES = [
  { value: "tshirt_s", label: "Small" },
  { value: "tshirt_m", label: "Medium" },
  { value: "tshirt_l", label: "Large" },
]

function question(over: Partial<EventQuestionDTO> = {}): EventQuestionDTO {
  return {
    id: QUESTION_ID,
    cleanupId: EVENT_ID,
    kind: "multi_select",
    prompt: "Shirt size",
    helpText: null,
    required: false,
    ticketTypeId: null,
    options: SIZES,
    maxSelections: 2,
    consentText: null,
    showIf: { questionId: OTHER_ID, equals: "yes" },
    sortOrder: 0,
    ...over,
  }
}

describe("toDef", () => {
  it("round-trips an untouched question exactly, including its condition and limit", () => {
    const def = toDef(toDraft(question()), 0)
    expect(def).toMatchObject({
      id: QUESTION_ID,
      kind: "multi_select",
      options: SIZES,
      maxSelections: 2,
      showIf: { questionId: OTHER_ID, equals: "yes" },
    })
    expect(EventQuestionDefSchema.safeParse(def).success).toBe(true)
  })

  it("drops the selection limit when the question stops being multi-select", () => {
    const draft = { ...toDraft(question()), kind: "single_select" as const }
    const def = toDef(draft, 0)
    expect(def).not.toHaveProperty("maxSelections")
    expect(EventQuestionDefSchema.safeParse(def).success).toBe(true)
  })
})

describe("optionList", () => {
  it("keeps a saved option's value when its label is edited in place or it moves", () => {
    expect(optionList("Small\nMedium (M)\nLarge", SIZES)).toEqual([
      { value: "tshirt_s", label: "Small" },
      { value: "tshirt_m", label: "Medium (M)" },
      { value: "tshirt_l", label: "Large" },
    ])
    expect(optionList("Large\nSmall", SIZES)).toEqual([
      { value: "tshirt_l", label: "Large" },
      { value: "tshirt_s", label: "Small" },
    ])
  })

  it("derives values only for new lines, and never twice the same one", () => {
    expect(optionList("Yes\nyes\nYES", [])).toEqual([
      { value: "yes", label: "Yes" },
      { value: "yes-2", label: "yes" },
      { value: "yes-3", label: "YES" },
    ])
    expect(optionList("Small\nXL", [{ value: "xl", label: "Small" }])).toEqual([
      { value: "xl", label: "Small" },
      { value: "xl-2", label: "XL" },
    ])
  })
})
