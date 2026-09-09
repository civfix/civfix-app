import { describe, expect, it } from "vitest"
import type { TFunction } from "i18next"
import type { PostCounts } from "@civfix/shared"
import {
  androidKeyboardInset,
  buildFocalPostStats,
  buildReplyComposerHeightPlan,
  buildThreadRailPlan,
  buildThreadRows,
  isOptimisticPostId,
  replyComposerState,
  threadFocalExcerpt,
  threadItems,
  threadRailSegment,
  MIN_THREAD_VISIBLE,
  REPLY_INPUT_MAX_CAP,
  REPLY_INPUT_MIN,
  REPLY_SURFACE_MIN,
  THREAD_MAX_INLINE_DEPTH,
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

const reply = (authorId: string) => ({ id: `${authorId}-${Math.random()}`, author: { id: authorId } })

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

describe("buildThreadRailPlan", () => {
  it("draws no rail when nobody continues the thread", () => {
    expect(buildThreadRailPlan([reply("b"), reply("c")], "a")).toEqual([
      { above: false, below: false },
      { above: false, below: false },
    ])
  })

  it("stubs a single leading self-reply up to the focal post", () => {
    expect(buildThreadRailPlan([reply("a"), reply("b")], "a")).toEqual([
      { above: true, below: false },
      { above: false, below: false },
    ])
  })

  it("connects a leading run of self-replies and stops at the stranger", () => {
    expect(buildThreadRailPlan([reply("a"), reply("a"), reply("a"), reply("b")], "a")).toEqual([
      { above: true, below: true },
      { above: true, below: true },
      { above: true, below: false },
      { above: false, below: false },
    ])
  })

  it("gives a self-reply that lands AFTER a stranger no rail - it is not a continuation", () => {
    expect(buildThreadRailPlan([reply("b"), reply("a"), reply("a")], "a")).toEqual([
      { above: false, below: false },
      { above: false, below: false },
      { above: false, below: false },
    ])
  })

  it("draws nothing when the focal author is unknown", () => {
    expect(buildThreadRailPlan([reply("a")], null)).toEqual([{ above: false, below: false }])
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

describe("androidKeyboardInset", () => {
  it("lifts the full keyboard when edge-to-edge nullified adjustResize", () => {
    expect(androidKeyboardInset(345, 874, 874)).toBe(345)
  })

  it("lifts nothing when the window already resized by the whole keyboard", () => {
    expect(androidKeyboardInset(345, 874, 529)).toBe(0)
  })

  it("lifts the remainder on a partial resize", () => {
    expect(androidKeyboardInset(345, 874, 700)).toBe(171)
  })

  it("never lifts on a closed keyboard", () => {
    expect(androidKeyboardInset(0, 874, 874)).toBe(0)
  })
})

const row = (
  id: string,
  authorId: string,
  replies = 0,
  replyToId: string | null = "focal",
) => ({ id, author: { id: authorId }, counts: { replies }, replyToId })

const flat = (replies: ReturnType<typeof row>[], focalAuthorId: string | null = "a") =>
  buildThreadRows({ focalId: "focal", focalAuthorId, replies })

describe("buildThreadRows (flat list)", () => {
  it("reproduces the self-thread rail plan when nothing is expanded", () => {
    const rows = flat([row("r1", "a"), row("r2", "a"), row("r3", "a"), row("r4", "b")])
    expect(rows.map((entry) => entry.rail)).toEqual([
      { above: true, below: true },
      { above: true, below: true },
      { above: true, below: false },
      { above: false, below: false },
    ])
  })

  it("drops the hairline on every chained row and keeps it where the chain ends", () => {
    const rows = flat([row("r1", "a"), row("r2", "a"), row("r3", "b")])
    expect(rows.map((entry) => entry.hairline)).toEqual([false, true, true])
  })

  it("draws no rail when nobody continues the thread", () => {
    const rows = flat([row("r1", "b"), row("r2", "c")])
    expect(rows.map((entry) => entry.rail)).toEqual([
      { above: false, below: false },
      { above: false, below: false },
    ])
  })

  it("gives a self-reply that lands AFTER a stranger no rail", () => {
    const rows = flat([row("r1", "b"), row("r2", "a"), row("r3", "a")])
    expect(rows.every((entry) => entry.rail.above === false && entry.rail.below === false)).toBe(true)
  })

  it("draws nothing when the focal author is unknown", () => {
    expect(flat([row("r1", "a")], null)[0]?.rail).toEqual({ above: false, below: false })
  })

  it("emits one depth-1 reply row per reply, keyed by post id, in fetched order", () => {
    const rows = flat([row("r1", "a"), row("r2", "b")])
    expect(rows.map((entry) => [entry.kind, entry.key, entry.depth])).toEqual([
      ["reply", "r1", 1],
      ["reply", "r2", 1],
    ])
  })

  it("offers `expand` only to a reply that has replies", () => {
    const rows = flat([row("r1", "a", 3), row("r2", "b", 0)])
    expect(rows.map((entry) => (entry.kind === "reply" ? entry.expansion : null)))
      .toEqual(["expand", "none"])
  })

  it("never offers an expand affordance on a row the server has not confirmed", () => {
    const rows = flat([row("optimistic-1712", "a", 4)])
    expect(rows[0]?.kind === "reply" && rows[0].optimistic).toBe(true)
    expect(rows[0]?.kind === "reply" && rows[0].expansion).toBe("none")
  })

  it("caps inline expansion two levels below the focal post", () => {
    expect(THREAD_MAX_INLINE_DEPTH).toBe(2)
  })
})

describe("isOptimisticPostId", () => {
  it("matches only the composer's temp-id prefix", () => {
    expect(isOptimisticPostId("optimistic-1712345678901")).toBe(true)
    expect(isOptimisticPostId("0f9a-real-uuid")).toBe(false)
    expect(isOptimisticPostId("")).toBe(false)
  })
})

describe("buildThreadRows (inline expansion)", () => {
  const expanded = (
    replies: ReturnType<typeof row>[],
    expandedIds: string[],
    children: Record<string, { items: ReturnType<typeof row>[]; loading: boolean; hasMore: boolean }>,
  ) =>
    buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies,
      expandedIds: new Set(expandedIds),
      children,
    })

  it("splices the children directly beneath their parent and nowhere else", () => {
    const rows = expanded(
      [row("r1", "b", 2), row("r2", "c")],
      ["r1"],
      { r1: { items: [row("c1", "d", 0, "r1"), row("c2", "e", 0, "r1")], loading: false, hasMore: false } },
    )
    expect(rows.map((entry) => [entry.kind, entry.key])).toEqual([
      ["reply", "r1"],
      ["nested", "r1:c1"],
      ["nested", "r1:c2"],
      ["reply", "r2"],
    ])
    expect(rows.map((entry) => entry.depth)).toEqual([1, 2, 2, 1])
  })

  it("threads the rail from the parent through every child and stops at the last one", () => {
    const rows = expanded(
      [row("r1", "b", 2)],
      ["r1"],
      { r1: { items: [row("c1", "d", 0, "r1"), row("c2", "e", 0, "r1")], loading: false, hasMore: false } },
    )
    expect(rows.map((entry) => entry.rail)).toEqual([
      { above: false, below: true },
      { above: true, below: true },
      { above: true, below: false },
    ])
    expect(rows.map((entry) => entry.hairline)).toEqual([false, false, true])
  })

  it("KEEPS THE RAILS ALIGNED under an insertion: the self-run breaks rather than lying", () => {
    const rows = expanded(
      [row("a1", "a", 1), row("a2", "a"), row("b1", "b")],
      ["a1"],
      { a1: { items: [row("c1", "z", 0, "a1")], loading: false, hasMore: false } },
    )
    expect(rows.map((entry) => entry.key)).toEqual(["a1", "a1:c1", "a2", "b1"])
    expect(rows.map((entry) => entry.rail)).toEqual([
      { above: true, below: true },
      { above: true, below: false },
      { above: false, below: false },
      { above: false, below: false },
    ])
  })

  it("falls back to the self-run rail when an expanded reply turns out to have no children", () => {
    const rows = expanded(
      [row("a1", "a", 1), row("a2", "a")],
      ["a1"],
      { a1: { items: [], loading: false, hasMore: false } },
    )
    expect(rows.map((entry) => entry.rail)).toEqual([
      { above: true, below: true },
      { above: true, below: false },
    ])
  })

  it("holds `above[k] === below[k-1]` across every expansion permutation", () => {
    const replies = [row("a1", "a", 2), row("a2", "a", 1), row("b1", "b", 3)]
    const childMap = {
      a1: { items: [row("x1", "z", 0, "a1"), row("x2", "z", 0, "a1")], loading: false, hasMore: false },
      a2: { items: [row("y1", "z", 0, "a2")], loading: false, hasMore: false },
      b1: { items: [], loading: true, hasMore: false },
    }
    for (const ids of [[], ["a1"], ["a2"], ["b1"], ["a1", "a2"], ["a1", "b1"], ["a1", "a2", "b1"]]) {
      const rows = expanded(replies, ids, childMap)
      for (let index = 1; index < rows.length; index += 1) {
        expect(rows[index]?.rail.above, `${ids.join("+")} @${index}`)
          .toBe(rows[index - 1]?.rail.below)
      }
      expect(new Set(rows.map((entry) => entry.key)).size).toBe(rows.length)
    }
  })

  it("ignores an expansion aimed at a row nobody is showing", () => {
    const rows = expanded([row("r1", "b", 2)], ["ghost"], {})
    expect(rows.map((entry) => entry.key)).toEqual(["r1"])
    expect(rows[0]?.kind === "reply" && rows[0].expansion).toBe("expand")
  })

  it("flips the parent's control to `collapse` while it is open", () => {
    const rows = expanded(
      [row("r1", "b", 1)],
      ["r1"],
      { r1: { items: [row("c1", "d", 0, "r1")], loading: false, hasMore: false } },
    )
    expect(rows[0]?.kind === "reply" && rows[0].expansion).toBe("collapse")
  })
})

describe("buildThreadRows (depth cap, cursors, optimistic rows)", () => {
  it("gives a depth-2 row a NAVIGATE affordance, never an expand one", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [row("r1", "b", 1)],
      expandedIds: new Set(["r1"]),
      children: { r1: { items: [row("c1", "d", 5, "r1")], loading: false, hasMore: false } },
    })
    expect(rows[1]?.kind).toBe("nested")
    expect(rows[1]?.kind === "nested" && rows[1].expansion).toBe("navigate")
  })

  it("never splices a THIRD level, however the caller marks it expanded", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [row("r1", "b", 1)],
      expandedIds: new Set(["r1", "c1"]),
      children: {
        r1: { items: [row("c1", "d", 2, "r1")], loading: false, hasMore: false },
        c1: { items: [row("g1", "e", 0, "c1"), row("g2", "e", 0, "c1")], loading: false, hasMore: false },
      },
    })
    expect(rows.map((entry) => entry.key)).toEqual(["r1", "r1:c1"])
  })

  it("emits ONE loading row while an expanded reply's first page is in flight", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [row("r1", "b", 3), row("r2", "c")],
      expandedIds: new Set(["r1"]),
      children: { r1: { items: [], loading: true, hasMore: false } },
    })
    expect(rows.map((entry) => [entry.kind, entry.key])).toEqual([
      ["reply", "r1"],
      ["loading", "loading:r1"],
      ["reply", "r2"],
    ])
    expect(rows[0]?.rail).toEqual({ above: false, below: true })
    expect(rows[1]?.rail).toEqual({ above: true, below: false })
  })

  it("closes the chain with a show-more cursor carrying what is still unread", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [row("r1", "b", 9)],
      expandedIds: new Set(["r1"]),
      children: {
        r1: { items: [row("c1", "d", 0, "r1"), row("c2", "d", 0, "r1")], loading: false, hasMore: true },
      },
    })
    expect(rows.map((entry) => entry.kind)).toEqual(["reply", "nested", "nested", "show-more"])
    expect(rows[3]?.kind === "show-more" && rows[3].remaining).toBe(7)
    expect(rows[3]?.kind === "show-more" && rows[3].parentId).toBe("r1")
    expect(rows[2]?.rail.below).toBe(true)
    expect(rows[3]?.rail).toEqual({ above: true, below: false })
    expect(rows[3]?.hairline).toBe(true)
  })

  it("never advertises fewer than one remaining reply when the count is stale", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [row("r1", "b", 1)],
      expandedIds: new Set(["r1"]),
      children: {
        r1: { items: [row("c1", "d", 0, "r1"), row("c2", "d", 0, "r1")], loading: false, hasMore: true },
      },
    })
    expect(rows[3]?.kind === "show-more" && rows[3].remaining).toBe(1)
  })

  it("appends a reply sent to the FOCAL post at the tail of the top-level list", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [row("r1", "b")],
      sent: [row("optimistic-1", "me", 0, "focal")],
    })
    expect(rows.map((entry) => entry.key)).toEqual(["r1", "optimistic-1"])
  })

  it("puts a reply sent to an EXPANDED CHILD under that child, not at the tail", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [row("r1", "b", 1), row("r2", "c")],
      sent: [row("optimistic-1", "me", 0, "r1")],
      expandedIds: new Set(["r1"]),
      children: { r1: { items: [row("c1", "d", 0, "r1")], loading: false, hasMore: false } },
    })
    expect(rows.map((entry) => entry.key)).toEqual(["r1", "r1:c1", "r1:optimistic-1", "r2"])
  })

  it("drops a sent reply the moment the fetched list carries its id, at either level", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [row("r1", "b", 1), row("s1", "me", 0, "focal")],
      sent: [row("s1", "me", 0, "focal"), row("s2", "me", 0, "r1"), row("s3", "me", 0, "focal")],
      expandedIds: new Set(["r1"]),
      children: { r1: { items: [row("s2", "me", 0, "r1")], loading: false, hasMore: false } },
    })
    expect(rows.map((entry) => entry.key)).toEqual(["r1", "r1:s2", "s1", "s3"])
    expect(new Set(rows.map((entry) => entry.key)).size).toBe(rows.length)
  })

  it("keeps a sent reply aimed at a COLLAPSED parent out of the top-level list", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [row("r1", "b", 1)],
      sent: [row("optimistic-1", "me", 0, "r1")],
    })
    expect(rows.map((entry) => entry.key)).toEqual(["r1"])
  })

  it("treats a sent reply with no replyToId as a reply to the focal post", () => {
    const rows = buildThreadRows({
      focalId: "focal",
      focalAuthorId: "a",
      replies: [],
      sent: [row("optimistic-1", "me", 0, null)],
    })
    expect(rows.map((entry) => entry.key)).toEqual(["optimistic-1"])
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

  it("hands buildThreadRailPlan the same interned segments", () => {
    const plan = buildThreadRailPlan(
      [{ author: { id: "a" } }, { author: { id: "a" } }, { author: { id: "b" } }],
      "a",
    )
    expect(plan[0]).toBe(threadRailSegment(true, true))
    expect(plan[1]).toBe(threadRailSegment(true, false))
    expect(plan[2]).toBe(threadRailSegment(false, false))
  })
})
