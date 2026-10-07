/**
 * The inbox's client-side filter.
 *
 * There is no `GET /threads?q=`: the inbox's search narrows the threads the infinite query has ALREADY
 * loaded, so the two things worth holding are (a) an empty query is not a filter, and (b) what a hit is
 * measured against is the RAW `last`, never the rendered preview.
 */
import { describe, expect, it } from "vitest"
import { matchesThreadQuery, threadRowActions, unreadBadgeLabel, UNREAD_BADGE_CAP } from "../messagesListModel"

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

describe("unreadBadgeLabel", () => {
  it("shows the count up to the cap and caps it past that", () => {
    expect(unreadBadgeLabel(1)).toBe(1)
    expect(unreadBadgeLabel(UNREAD_BADGE_CAP)).toBe(99)
    expect(unreadBadgeLabel(UNREAD_BADGE_CAP + 1)).toBe("99+")
    expect(unreadBadgeLabel(1234)).toBe("99+")
  })
})

describe("threadRowActions", () => {
  const labels = { mute: "Mute", markRead: "Mark read", delete: "Delete", deleteA11y: "Delete conversation" }

  it("offers mark-read ONLY where there is something to clear", () => {
    expect(threadRowActions({ unread: true, muted: false, labels }).map((a) => a.key)).toEqual([
      "mute",
      "markRead",
      "delete",
    ])
    expect(threadRowActions({ unread: false, muted: false, labels }).map((a) => a.key)).toEqual(["mute", "delete"])
  })

  it("swaps the mute glyph with the muted state", () => {
    expect(threadRowActions({ unread: false, muted: false, labels })[0]?.icon).toBe("BellOff")
    expect(threadRowActions({ unread: false, muted: true, labels })[0]?.icon).toBe("Bell")
  })

  it("makes delete the destructive Trash2 action with its own accessible label", () => {
    const del = threadRowActions({ unread: true, muted: false, labels }).at(-1)
    expect(del).toEqual({
      key: "delete",
      label: "Delete",
      a11yLabel: "Delete conversation",
      icon: "Trash2",
      tone: "delete",
      destructive: true,
    })
  })

  it("announces mute and mark-read by their visible labels, and nothing else is destructive", () => {
    const [mute, markRead] = threadRowActions({ unread: true, muted: false, labels })
    expect(mute).toMatchObject({ a11yLabel: "Mute", tone: "mute", destructive: false })
    expect(markRead).toMatchObject({ a11yLabel: "Mark read", icon: "CheckCheck", tone: "read", destructive: false })
  })
})
