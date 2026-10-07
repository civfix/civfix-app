import { describe, expect, it } from "vitest"
import type { EventPageBlock } from "@civfix/shared"
import { SaveEventPageRequestSchema } from "@civfix/shared"

import {
  blockSaveErrors,
  blocksDiffer,
  normalizeBlocksForSave,
  rowKey,
  withRowKey,
  withRowKeys,
} from "./blocks"

const EVENT_ID = "33333333-3333-4333-8333-333333333333"

const saveable = (blocks: EventPageBlock[]) =>
  SaveEventPageRequestSchema.safeParse({ id: EVENT_ID, blocks }).success

describe("normalizeBlocksForSave", () => {
  it("turns a cleared optional link or reply-to into null instead of an invalid empty string", () => {
    const blocks: EventPageBlock[] = [
      { id: "d1", kind: "donate", title: "  Chip in ", url: "" },
      { id: "c1", kind: "contact", body: "", replyTo: " " },
    ]
    expect(saveable(blocks)).toBe(false)
    const normalized = normalizeBlocksForSave(blocks)
    expect(normalized).toEqual([
      { id: "d1", kind: "donate", title: "Chip in", url: null },
      { id: "c1", kind: "contact", body: null, replyTo: null },
    ])
    expect(saveable(normalized)).toBe(true)
  })

  it("drops rows the host added but never filled in", () => {
    const blocks: EventPageBlock[] = [
      {
        id: "a1",
        kind: "agenda",
        items: [
          { title: "", time: null, description: null },
          { title: " Check-in ", time: "9:00", description: "" },
        ],
      },
      { id: "h1", kind: "hosts", entries: [{ name: "" }] },
      { id: "f1", kind: "faq", items: [{ question: "", answer: "" }] },
      { id: "s1", kind: "sponsors", entries: [{ name: "  " }] },
    ]
    expect(saveable(blocks)).toBe(false)
    const normalized = normalizeBlocksForSave(blocks)
    expect(normalized[0]).toEqual({
      id: "a1",
      kind: "agenda",
      items: [{ title: "Check-in", time: "9:00", description: null }],
    })
    expect(normalized.slice(1)).toEqual([
      { id: "h1", kind: "hosts", entries: [] },
      { id: "f1", kind: "faq", items: [] },
      { id: "s1", kind: "sponsors", entries: [] },
    ])
    expect(saveable(normalized)).toBe(true)
  })

  it("keeps the about body as written, since it is Markdown and required", () => {
    const about: EventPageBlock = { id: "b1", kind: "about", body: "**Hi**\n" }
    expect(normalizeBlocksForSave([about])).toEqual([about])
  })
})

describe("blockSaveErrors", () => {
  it("is empty when the normalized blocks are valid", () => {
    expect(blockSaveErrors([{ id: "d1", kind: "donate", url: "" }])).toEqual({})
  })

  it("points each issue at the editor's own row, past dropped blank rows", () => {
    const errors = blockSaveErrors([
      {
        id: "f1",
        kind: "faq",
        items: [
          { question: "", answer: "" },
          { question: "Parking?", answer: "" },
        ],
      },
      { id: "a1", kind: "agenda", items: [{ title: "", time: "10:00" }] },
      { id: "d1", kind: "donate", url: "http://insecure.example" },
      { id: "c1", kind: "contact", replyTo: "not-an-email" },
    ])
    expect(errors).toEqual({
      f1: { "items.1.answer": "required" },
      a1: { "items.0.title": "required" },
      d1: { url: "url" },
      c1: { replyTo: "email" },
    })
  })
})

describe("blocksDiffer", () => {
  it("ignores what saving would normalize away, and sees a real edit", () => {
    const saved: EventPageBlock[] = [{ id: "d1", kind: "donate", title: "Give", url: null }]
    expect(blocksDiffer([{ id: "d1", kind: "donate", title: "Give " }], saved)).toBe(false)
    expect(blocksDiffer([{ id: "d1", kind: "donate", title: "Give now" }], saved)).toBe(true)
  })
})

describe("editor row keys", () => {
  const loaded: EventPageBlock[] = [
    {
      id: "a1",
      kind: "agenda",
      items: [
        { title: "Check-in", time: "9:00", description: null },
        { title: "Cleanup", time: null, description: "Gloves provided" },
      ],
    },
    { id: "h1", kind: "hosts", entries: [{ name: "Rosa", role: "Lead" }] },
    { id: "f1", kind: "faq", items: [{ question: "Parking?", answer: "Street" }] },
    { id: "s1", kind: "sponsors", entries: [{ name: "Hardware Co", url: null }] },
    { id: "b1", kind: "about", body: "Hello" },
  ]

  it("gives every row a distinct key that survives an edit", () => {
    const keyed = withRowKeys(loaded)
    const agenda = keyed[0] as Extract<EventPageBlock, { kind: "agenda" }>
    const keys = agenda.items.map(rowKey)
    expect(new Set(keys).size).toBe(2)
    expect(keys.every((key) => typeof key === "string")).toBe(true)
    expect(rowKey({ ...agenda.items[1]!, title: "Cleanup crew" })).toBe(keys[1])
  })

  it("never reaches the save payload, which stays exactly what an unkeyed editor sends", () => {
    const keyed = withRowKeys(loaded)
    const agenda = keyed[0] as Extract<EventPageBlock, { kind: "agenda" }>
    const edited: EventPageBlock[] = [
      { ...agenda, items: [...agenda.items, withRowKey({ title: "", time: null, description: null })] },
      ...keyed.slice(1),
    ]
    const payload = normalizeBlocksForSave(edited)
    expect(JSON.stringify(payload)).toBe(JSON.stringify(normalizeBlocksForSave(loaded)))
    for (const block of payload) {
      const rows = (block as { items?: object[]; entries?: object[] }).items ??
        (block as { entries?: object[] }).entries ??
        []
      for (const row of rows) expect(Object.getOwnPropertySymbols(row)).toEqual([])
    }
    expect(saveable(payload)).toBe(true)
    expect(blocksDiffer(edited, loaded)).toBe(false)
    expect(blockSaveErrors(edited)).toEqual({})
  })
})
