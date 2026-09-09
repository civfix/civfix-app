/**
 * The inbox's client-side filter.
 *
 * There is no `GET /threads?q=` — the inbox's search narrows the threads the infinite query has ALREADY
 * loaded, so the two things worth holding are (a) an empty query is not a filter, and (b) what a hit is
 * measured against is the RAW `last`, never the rendered preview.
 */
import { describe, expect, it } from "vitest"
import { matchesThreadQuery } from "../messagesListModel"

const thread = (title: string, last?: string | null) => ({ title, last })

describe("matchesThreadQuery", () => {
  it("treats an empty or whitespace query as no filter at all", () => {
    expect(matchesThreadQuery(thread("Elm St crew"), "")).toBe(true)
    expect(matchesThreadQuery(thread("Elm St crew"), "   ")).toBe(true)
  })

  it("matches the thread title, case-folded and anywhere in the string", () => {
    expect(matchesThreadQuery(thread("Elm St crew"), "ELM")).toBe(true)
    expect(matchesThreadQuery(thread("Elm St crew"), "st cr")).toBe(true)
    expect(matchesThreadQuery(thread("Elm St crew"), "oak")).toBe(false)
  })

  it("matches the last message's text too, so a thread is findable by what was said in it", () => {
    expect(matchesThreadQuery(thread("Ada Lovelace", "the bin is overflowing"), "bin")).toBe(true)
    expect(matchesThreadQuery(thread("Ada Lovelace", "the bin is overflowing"), "gutter")).toBe(false)
  })

  it("survives a thread that has no last message", () => {
    expect(matchesThreadQuery(thread("Ada Lovelace", null), "ada")).toBe(true)
    expect(matchesThreadQuery(thread("Ada Lovelace"), "bin")).toBe(false)
  })

  it("trims the query, so a trailing space from a soft keyboard is not a different search", () => {
    expect(matchesThreadQuery(thread("Elm St crew"), " elm ")).toBe(true)
  })

  it("does NOT see the rendered 'You: ' prefix - that is the row's copy, not the thread's text", () => {
    // `previewText` prefixes the viewer's own messages with a LOCALIZED "You: ". Matching against that
    // string would make every outgoing thread a hit for the letters in "you" in whichever locale is
    // active (and a different set of threads in each locale), which is not a search result anyone asked
    // for. The filter reads the DTO, the row reads the copy.
    expect(matchesThreadQuery(thread("Ada Lovelace", "on my way"), "you")).toBe(false)
  })
})
