import { describe, expect, it } from "vitest"
import type { TFunction } from "i18next"
import type { PostCounts } from "@civfix/shared"
import {
  buildFocalPostStats,
  buildReplyComposerHeightPlan,
  buildThreadRows,
  composerFocusAfterSend,
  isOptimisticPostId,
  optimisticPostId,
  replyComposerState,
  threadFocalExcerpt,
  threadItems,
  threadRailSegment,
  MIN_THREAD_VISIBLE,
  REPLY_INPUT_MAX_CAP,
  REPLY_INPUT_MIN,
  REPLY_SURFACE_MIN,
} from "../threadModel"

const EN: Record<string, string> = {
  "thread.stats.replies_one": "{{count}} Reply",
  "thread.stats.replies_other": "{{count}} Replies",
  "thread.stats.reposts_one": "{{count}} Repost",
  "thread.stats.reposts_other": "{{count}} Reposts",
  "thread.stats.likes_one": "{{count}} Like",
  "thread.stats.likes_other": "{{count}} Likes",
  "post_card.media_a11y": "Post attachment",
}

const t = ((key: string, options: Record<string, unknown> = {}) => {
  const count = options.count
  const resolved = typeof count === "number"
    ? EN[`${key}${count === 1 ? "_one" : "_other"}`]
    : EN[key]
  if (resolved == null) throw new Error(`missing translation: ${key}`)
  return resolved.replace(/{{(\w+)}}/g, (_m, name: string) => String(options[name] ?? ""))
}) as unknown as TFunction

const counts = (over: Partial<PostCounts> = {}): PostCounts => ({
  likes: 0,
  reposts: 0,
  replies: 0,
  saves: 0,
  ...over,
})

describe("buildReplyComposerHeightPlan", () => {
  const CASES = [
    { name: "402x874, keyboard up", rootHeight: 815, keyboardInset: 345,
      available: 418, surfaceMax: 259, inputMax: 132, inputMaxThumbs: 95, trayMax: 151 },
    { name: "402x874, keyboard down", rootHeight: 815, keyboardInset: 0,
      available: 763, surfaceMax: 473, inputMax: 132, inputMaxThumbs: 132, trayMax: 168 },
    { name: "375x667, keyboard up", rootHeight: 647, keyboardInset: 260,
      available: 335, surfaceMax: 203, inputMax: 111, inputMaxThumbs: 40, trayMax: 124 },
    { name: "375x667, keyboard down", rootHeight: 647, keyboardInset: 0,
      available: 595, surfaceMax: 369, inputMax: 132, inputMaxThumbs: 132, trayMax: 168 },
    { name: "320x568, keyboard up", rootHeight: 548, keyboardInset: 216,
      available: 280, surfaceMax: 148, inputMax: 56, inputMaxThumbs: 40, trayMax: 124 },
  ] as const

  it.each(CASES)(
    "budgets $name exactly",
    ({ rootHeight, keyboardInset, available, surfaceMax, inputMax, inputMaxThumbs, trayMax }) => {
      const plain = buildReplyComposerHeightPlan({
        rootHeight, keyboardInset, expanded: true, hasThumbs: false, measuredChrome: null,
      })
      expect(plain).toEqual({ available, surfaceMax, inputMax, trayMax })

      const thumbs = buildReplyComposerHeightPlan({
        rootHeight, keyboardInset, expanded: true, hasThumbs: true, measuredChrome: null,
      })
      expect(thumbs.inputMax).toBe(inputMaxThumbs)
      expect(thumbs.surfaceMax).toBe(surfaceMax)
    },
  )

  it("keeps the composer at one line while collapsed", () => {
    const plan = buildReplyComposerHeightPlan({
      rootHeight: 815, keyboardInset: 0, expanded: false, hasThumbs: false, measuredChrome: null,
    })
    expect(plan.inputMax).toBe(REPLY_INPUT_MIN)
  })

  it("leaves the reference device room for the composer AND the thread", () => {
    const plan = buildReplyComposerHeightPlan({
      rootHeight: 815, keyboardInset: 345, expanded: true, hasThumbs: false, measuredChrome: null,
    })
    expect(92 + plan.inputMax).toBeLessThanOrEqual(plan.surfaceMax)
    expect(plan.available - (92 + plan.inputMax)).toBeGreaterThanOrEqual(MIN_THREAD_VISIBLE)
  })

  it("holds every height invariant across the device / keyboard / chrome matrix", () => {
    for (const rootHeight of [568, 667, 812, 874, 926]) {
      for (const keyboardInset of [0, 216, 260, 291, 345]) {
        for (const measuredChrome of [null, 60, 92, 130, 170, 210, 260]) {
          for (const hasThumbs of [true, false]) {
            for (const expanded of [true, false]) {
              const plan = buildReplyComposerHeightPlan({
                rootHeight, keyboardInset, expanded, hasThumbs, measuredChrome,
              })
              const where = `${rootHeight}/${keyboardInset}/${measuredChrome}/${hasThumbs}/${expanded}`
              expect(plan.inputMax, where).toBeGreaterThanOrEqual(REPLY_INPUT_MIN)
              expect(plan.inputMax, where).toBeLessThanOrEqual(REPLY_INPUT_MAX_CAP)
              expect(
                plan.surfaceMax <= plan.available - MIN_THREAD_VISIBLE
                  || plan.surfaceMax === REPLY_SURFACE_MIN,
                where,
              ).toBe(true)
              expect(plan.trayMax + plan.surfaceMax, where).toBeLessThanOrEqual(plan.available)
            }
          }
        }
      }
    }
  })
})

describe("threadItems", () => {
  it("appends locally-sent replies after the fetched ones", () => {
    expect(threadItems([{ id: "r1" }, { id: "r2" }], [{ id: "local" }]).map((p) => p.id))
      .toEqual(["r1", "r2", "local"])
  })

  it("drops a sent reply the moment the authoritative list carries its id", () => {
    const merged = threadItems([{ id: "r1" }, { id: "local" }], [{ id: "local" }])
    expect(merged.map((p) => p.id)).toEqual(["r1", "local"])
    expect(new Set(merged.map((p) => p.id)).size).toBe(merged.length)
  })

  it("never emits a duplicate key even when both sides repeat", () => {
    const merged = threadItems([{ id: "r1" }, { id: "r1" }], [{ id: "r1" }, { id: "r2" }, { id: "r2" }])
    expect(merged.map((p) => p.id)).toEqual(["r1", "r2"])
  })
})

describe("buildFocalPostStats", () => {
  it("orders replies, reposts, likes and omits every zero", () => {
    expect(buildFocalPostStats(counts({ replies: 12, reposts: 0, likes: 41, saves: 9 }), t)).toEqual([
      { key: "replies", count: 12, label: "12 Replies" },
      { key: "likes", count: 41, label: "41 Likes" },
    ])
  })

  it("uses the singular form at one", () => {
    expect(buildFocalPostStats(counts({ reposts: 1 }), t)).toEqual([
      { key: "reposts", count: 1, label: "1 Repost" },
    ])
  })

  it("returns nothing for an untouched post, so the row and its divider both disappear", () => {
    expect(buildFocalPostStats(counts(), t)).toEqual([])
  })
})

describe("threadFocalExcerpt", () => {
  const media = [{
    id: "m1", kind: "image" as const, url: "https://example.com/a.jpg",
    thumbUrl: null, width: 1200, height: 900, status: "ready" as const,
  }]

  it("collapses whitespace so a multi-line body still fills one line", () => {
    expect(threadFocalExcerpt(
      { body: "Line one\n\n  Line   two ", event: null, report: null, media: [] }, t,
    )).toBe("Line one Line two")
  })

  it("falls back to the linked event, then the report, then the attachment", () => {
    const event = { id: "e1", title: "Beach Cleanup" } as never
    const report = { id: "r1", title: "Pothole on Sunset" } as never
    expect(threadFocalExcerpt({ body: "", event, report, media: [] }, t)).toBe("Beach Cleanup")
    expect(threadFocalExcerpt({ body: null, event: null, report, media: [] }, t))
      .toBe("Pothole on Sunset")
    expect(threadFocalExcerpt({ body: null, event: null, report: null, media }, t))
      .toBe("Post attachment")
    expect(threadFocalExcerpt({ body: null, event: null, report: null, media: [] }, t)).toBe("")
  })
})

describe("replyComposerState", () => {
  const base = {
    focused: false, hasDraft: false, hasAttachments: false, signedIn: true, hasError: false,
  }

  it("shows the sign-in bar to a signed-out reader whatever else is true", () => {
    expect(replyComposerState({ ...base, signedIn: false })).toBe("signed-out")
    expect(replyComposerState({ ...base, signedIn: false, focused: true, hasDraft: true }))
      .toBe("signed-out")
  })

  it("rests collapsed", () => {
    expect(replyComposerState(base)).toBe("collapsed")
  })

  it("expands on focus, a draft, an attachment or an unseen error - each independently", () => {
    expect(replyComposerState({ ...base, focused: true })).toBe("expanded")
    expect(replyComposerState({ ...base, hasDraft: true })).toBe("expanded")
    expect(replyComposerState({ ...base, hasAttachments: true })).toBe("expanded")
    expect(replyComposerState({ ...base, hasError: true })).toBe("expanded")
  })
})

const row = (
  id: string,
  authorId: string,
  replies = 0,
  replyToId: string | null = "focal",
) => ({ id, author: { id: authorId }, counts: { replies }, replyToId })

const flat = (replies: ReturnType<typeof row>[]) => buildThreadRows({ focalId: "focal", replies })

describe("buildThreadRows", () => {
  it("emits one row per reply, keyed by post id, in fetched order", () => {
    const rows = flat([row("r1", "a"), row("r2", "b")])
    expect(rows.map((entry) => entry.key)).toEqual(["r1", "r2"])
    expect(rows.map((entry) => entry.post.id)).toEqual(["r1", "r2"])
  })

  /**
   * The whole point of the flat model: a reply's OWN replies never appear on this screen, however many it
   * has. They live on that reply's thread, which the row itself opens. Nothing here splices a child in.
   */
  it("never splices a reply's own replies into the list", () => {
    const rows = flat([row("r1", "b", 12), row("r2", "c", 0)])
    expect(rows).toHaveLength(2)
    expect(rows.map((entry) => entry.post.counts.replies)).toEqual([12, 0])
  })

  /**
   * The connector means ONE thing: the row above is this row's parent. Direct replies to the focal post
   * are siblings of each other, so a list of them never draws a line - however many share an author.
   */
  it("never connects sibling replies, whoever wrote them", () => {
    const rows = flat([row("r1", "a"), row("r2", "a"), row("r3", "a"), row("r4", "b")])
    expect(rows.map((entry) => entry.rail)).toEqual([
      { above: false, below: false },
      { above: false, below: false },
      { above: false, below: false },
      { above: false, below: false },
    ])
    expect(rows.every((entry) => entry.hairline)).toBe(true)
  })

  /**
   * The one nesting X keeps in a conversation: the post author's answer to a reply, shown under it as a
   * same-left-edge row joined by the connector. One row only - the rest live on that reply's own thread.
   */
  it("inlines the author reply under its parent, connected, and only one per parent", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      replies: [row("r1", "b"), row("r2", "c")],
      nested: [row("n1", "a", 0, "r1"), row("n2", "a", 0, "r1")],
    })
    expect(rows.map((entry) => entry.key)).toEqual(["r1", "r1:n1", "r2"])
    expect(rows.map((entry) => entry.rail)).toEqual([
      { above: false, below: true },
      { above: true, below: false },
      { above: false, below: false },
    ])
  })

  it("swallows the divider between a parent and its inlined reply, and keeps the one that closes the pair", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      replies: [row("r1", "b"), row("r2", "c")],
      nested: [row("n1", "a", 0, "r1")],
    })
    expect(rows.map((entry) => entry.hairline)).toEqual([false, true, true])
  })

  it("drops an inlined reply whose parent is not on this page", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      replies: [row("r1", "b")],
      nested: [row("n1", "a", 0, "somewhere-else"), row("n2", "a", 0, null)],
    })
    expect(rows.map((entry) => entry.key)).toEqual(["r1"])
  })

  it("flags an inlined reply the server has not confirmed, like any other row", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      replies: [row("r1", "b")],
      nested: [row("optimistic-9", "a", 0, "r1")],
    })
    expect(rows.map((entry) => entry.optimistic)).toEqual([false, true])
  })

  it("holds `above[k] === below[k-1]`, so a drawn line never dangles", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      replies: [row("r1", "b"), row("r2", "c")],
      nested: [row("n1", "a", 0, "r1")],
    })
    rows.forEach((entry, index) => {
      if (index === 0) return
      expect(entry.rail.above, `row ${index}`).toBe(rows[index - 1]?.rail.below)
    })
  })

  it("flags a row the server has not confirmed yet", () => {
    const rows = flat([row("optimistic-1712", "a", 4), row("r2", "b")])
    expect(rows.map((entry) => entry.optimistic)).toEqual([true, false])
  })

  it("appends a reply sent to the FOCAL post at the tail of the list", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      replies: [row("r1", "b")],
      sent: [row("optimistic-1", "me", 0, "focal")],
    })
    expect(rows.map((entry) => entry.key)).toEqual(["r1", "optimistic-1"])
  })

  it("treats a sent reply with no replyToId as a reply to the focal post", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      replies: [],
      sent: [row("optimistic-1", "me", 0, null)],
    })
    expect(rows.map((entry) => entry.key)).toEqual(["optimistic-1"])
  })

  /**
   * A reply sent from ANOTHER thread (the composer there aims at that thread's focal post) must not leak
   * into this one just because the screen kept it in its sent tail.
   */
  it("keeps a sent reply aimed at some other post out of the list", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      replies: [row("r1", "b", 1)],
      sent: [row("optimistic-1", "me", 0, "r1")],
    })
    expect(rows.map((entry) => entry.key)).toEqual(["r1"])
  })

  it("drops a sent reply the moment the fetched list carries its id", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      replies: [row("r1", "b"), row("s1", "me", 0, "focal")],
      sent: [row("s1", "me", 0, "focal"), row("s2", "me", 0, "focal")],
    })
    expect(rows.map((entry) => entry.key)).toEqual(["r1", "s1", "s2"])
    expect(new Set(rows.map((entry) => entry.key)).size).toBe(rows.length)
  })
})

describe("isOptimisticPostId", () => {
  it("matches only the composer's temp-id prefix", () => {
    expect(isOptimisticPostId("optimistic-1712345678901")).toBe(true)
    expect(isOptimisticPostId("0f9a-real-uuid")).toBe(false)
    expect(isOptimisticPostId("")).toBe(false)
  })
})

describe("optimisticPostId", () => {
  it("mints an id isOptimisticPostId recognises, keyed by the clock", () => {
    expect(optimisticPostId(1712345678901)).toBe("optimistic-1712345678901")
    expect(isOptimisticPostId(optimisticPostId(0))).toBe(true)
  })
})

describe("threadRailSegment - interned rail identities", () => {
  it("returns the SAME object per shape, so a rows rebuild cannot defeat ThreadReplyRow's memo", () => {
    expect(threadRailSegment(false, false)).toBe(threadRailSegment(false, false))
    expect(threadRailSegment(true, false)).toBe(threadRailSegment(true, false))
    expect(threadRailSegment(false, true)).toBe(threadRailSegment(false, true))
    expect(threadRailSegment(true, true)).toBe(threadRailSegment(true, true))
    expect(threadRailSegment(true, true)).toEqual({ above: true, below: true })
  })

  it("keeps rail identity STABLE across two buildThreadRows runs over equal input", () => {
    const build = () => flat([row("r1", "a"), row("r2", "a"), row("r3", "b")])
    const first = build()
    const second = build()
    first.forEach((entry, index) => {
      expect(second[index]?.rail).toBe(entry.rail)
    })
  })
})

describe("composerFocusAfterSend", () => {
  it("keeps the caret in a chat composer, where send -> send is the whole surface", () => {
    expect(composerFocusAfterSend("chat")).toBe("keep")
  })

  it("releases a thread reply, so the reply chip and the keyboard leave with the sent reply", () => {
    expect(composerFocusAfterSend("thread-reply")).toBe("release")
  })

  it("collapses the composer once the release drops focus", () => {
    const base = { hasDraft: false, hasAttachments: false, signedIn: true, hasError: false }
    expect(replyComposerState({ ...base, focused: true })).toBe("expanded")
    expect(replyComposerState({ ...base, focused: false })).toBe("collapsed")
  })
})
