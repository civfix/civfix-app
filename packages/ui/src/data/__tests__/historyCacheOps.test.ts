import { describe, expect, it } from "vitest"
import type { ChatHistoryResponse, ChatMessageDTO, PersonDTO } from "@civfix/shared"
import {
  MAX_JOURNALED_FRAMES,
  applyHistoryCacheOps,
  journalFrames,
  patchMessageInPages,
  prunableFrameIds,
  shouldResetToNewestPage,
  type HistoryCacheData,
  type HistoryCacheOp,
} from "../inbound"

const ROOM = "room-1"
const OTHER = "user-other"

function person(id: string): PersonDTO {
  return { id, name: id, followers: 0, following: 0, isFollowing: false } as PersonDTO
}

function msg(
  partial: Partial<ChatMessageDTO> & { id: string; createdAt: string; fromId?: string },
): ChatMessageDTO {
  const { fromId, ...rest } = partial
  return {
    cleanupId: ROOM,
    from: person(fromId ?? OTHER),
    body: rest.id,
    kind: "text",
    attachments: [],
    reactions: [],
    mentions: [],
    ...rest,
  } as ChatMessageDTO
}

function page(items: ChatMessageDTO[], nextCursor: string | null = null): ChatHistoryResponse {
  return { items, nextCursor }
}

function at(day: number): string {
  return `2026-01-${String(day).padStart(2, "0")}T00:00:00.000Z`
}

describe("the fold-vs-in-flight-fetch race (journal + drain)", () => {
  it("a fold journaled during a fetch survives the fetch settling with the STALE page snapshot", () => {
    const snapshotAtFetchStart = [page([msg({ id: "m1", createdAt: at(1) })], "older-1")]

    const inbound = msg({ id: "m2", createdAt: at(2) })
    const journal: HistoryCacheOp[] = [{ kind: "frames", frames: [{ message: inbound }] }]

    const olderPage = page([msg({ id: "m0", createdAt: at(1) })])
    const settled: HistoryCacheData = {
      pages: [...snapshotAtFetchStart, olderPage],
      pageParams: [undefined, "older-1"],
    }

    const drained = applyHistoryCacheOps(settled, journal)

    expect(drained.pages[0]?.items.map((m) => m.id)).toEqual(["m1", "m2"])
    expect(drained.pages[1]).toBe(olderPage)
  })

  it("re-applying a journaled patch after settle restores an optimistic write the snapshot clobbered", () => {
    const reacted = { reactions: [{ emoji: "❤️" as const, count: 1, mine: true }] }
    const journal: HistoryCacheOp[] = [{ kind: "patch", messageId: "m1", patch: reacted }]

    const settled: HistoryCacheData = {
      pages: [page([msg({ id: "m1", createdAt: at(1) })], "older")],
      pageParams: [undefined],
    }

    const drained = applyHistoryCacheOps(settled, journal)

    expect(drained.pages[0]?.items[0]?.reactions).toEqual(reacted.reactions)
  })

  it("applies ops in arrival order: a fold then a REST-truth patch for the same message", () => {
    const inbound = msg({ id: "m2", createdAt: at(2) })
    const journal: HistoryCacheOp[] = [
      { kind: "frames", frames: [{ message: inbound }] },
      { kind: "patch", messageId: "m2", patch: { body: "rest-truth" } },
    ]
    const settled: HistoryCacheData = {
      pages: [page([msg({ id: "m1", createdAt: at(1) })])],
      pageParams: [undefined],
    }

    const drained = applyHistoryCacheOps(settled, journal)

    expect(drained.pages[0]?.items.map((m) => m.id)).toEqual(["m1", "m2"])
    expect(drained.pages[0]?.items[1]?.body).toBe("rest-truth")
  })

  it("draining is idempotent against a settle that already contains the journaled message", () => {
    const inbound = msg({ id: "m2", createdAt: at(2) })
    const journal: HistoryCacheOp[] = [{ kind: "frames", frames: [{ message: inbound }] }]
    const settled: HistoryCacheData = {
      pages: [page([msg({ id: "m1", createdAt: at(1) }), msg({ id: "m2", createdAt: at(2) })])],
      pageParams: [undefined],
    }

    const drained = applyHistoryCacheOps(settled, journal)

    expect(drained.pages[0]?.items.map((m) => m.id)).toEqual(["m1", "m2"])
  })

  it("returns the input data unchanged (same reference) when no op changes anything", () => {
    const data: HistoryCacheData = {
      pages: [page([msg({ id: "m1", createdAt: at(1) })])],
      pageParams: [undefined],
    }
    expect(applyHistoryCacheOps(data, [{ kind: "patch", messageId: "missing", patch: { body: "x" } }])).toBe(
      data,
    )
  })
})

describe("prunableFrameIds", () => {
  it("collects ids + effective clientIds ONLY for messages present in the final pages", () => {
    const ops: HistoryCacheOp[] = [
      {
        kind: "frames",
        frames: [
          { message: msg({ id: "m1", createdAt: at(1) }) },
          { message: msg({ id: "m2", createdAt: at(2) }), explicitClientId: "cid-2" },
          { message: msg({ id: "m3", createdAt: at(3), clientId: "cid-3" }) },
        ],
      },
      { kind: "patch", messageId: "m9", patch: { body: "x" } },
    ]
    const finalPages = [page([msg({ id: "m1", createdAt: at(1) }), msg({ id: "m2", createdAt: at(2) })])]
    expect(prunableFrameIds(ops, finalPages)).toEqual(new Set(["m1", "m2", "cid-2"]))
  })

  it("a reset newestPage op that discards an earlier fold leaves that message UNPRUNED (it stays live)", () => {
    const data: HistoryCacheData = {
      pages: [page([msg({ id: "m1", createdAt: at(1) })], "older")],
      pageParams: [undefined],
    }
    const ops: HistoryCacheOp[] = [
      { kind: "frames", frames: [{ message: msg({ id: "m2", createdAt: at(2) }) }] },
      {
        kind: "newestPage",
        page: page([msg({ id: "m9", createdAt: at(9) })], "cursor-below-gap"),
      },
    ]

    const next = applyHistoryCacheOps(data, ops)

    expect(next.pages.flatMap((p) => p.items.map((m) => m.id))).toEqual(["m9"])
    expect(prunableFrameIds(ops, next.pages)).toEqual(new Set())
  })
})

describe("journalFrames (bounded journal)", () => {
  const frame = (n: number) => ({ message: msg({ id: `m${n}`, createdAt: at(1) }) })

  it("coalesces into the trailing frames op instead of growing the op list per 50ms batch", () => {
    let ops: HistoryCacheOp[] = []
    ops = journalFrames(ops, [frame(1)])
    ops = journalFrames(ops, [frame(2), frame(3)])
    expect(ops).toHaveLength(1)
    expect(ops[0]?.kind === "frames" && ops[0].frames.map((f) => f.message.id)).toEqual([
      "m1",
      "m2",
      "m3",
    ])
  })

  it("keeps patch ordering: frames around a patch stay separate ops in arrival order", () => {
    let ops: HistoryCacheOp[] = [{ kind: "frames", frames: [frame(1)] }]
    ops = [...ops, { kind: "patch", messageId: "m1", patch: { body: "x" } }]
    ops = journalFrames(ops, [frame(2)])
    expect(ops.map((o) => o.kind)).toEqual(["frames", "patch", "frames"])
  })

  it("drops the OLDEST frames beyond the cap and never touches patch ops", () => {
    let ops: HistoryCacheOp[] = [{ kind: "patch", messageId: "m0", patch: { body: "x" } }]
    ops = journalFrames(ops, Array.from({ length: 4 }, (_, i) => frame(i + 1)), 3)
    const framesOp = ops.find((o) => o.kind === "frames")
    expect(ops[0]?.kind).toBe("patch")
    expect(framesOp?.kind === "frames" && framesOp.frames.map((f) => f.message.id)).toEqual([
      "m2",
      "m3",
      "m4",
    ])
  })

  it("removes frames ops emptied by the cap entirely", () => {
    let ops: HistoryCacheOp[] = [{ kind: "frames", frames: [frame(1)] }]
    ops = [...ops, { kind: "patch", messageId: "m1", patch: { body: "x" } }]
    ops = journalFrames(ops, [frame(2), frame(3)], 2)
    expect(ops.map((o) => o.kind)).toEqual(["patch", "frames"])
  })

  it("defaults to a bound that holds ten pages of history", () => {
    expect(MAX_JOURNALED_FRAMES).toBe(300)
  })
})

describe("patchMessageInPages", () => {
  it("patches the message wherever it lives, items and pins alike", () => {
    const pinned = msg({ id: "p1", createdAt: at(1), pinnedAt: at(2) })
    const pages: ChatHistoryResponse[] = [
      { ...page([msg({ id: "p1", createdAt: at(1), pinnedAt: at(2) })]), pins: [pinned] },
      page([msg({ id: "m0", createdAt: at(1) })]),
    ]

    const next = patchMessageInPages(pages, "p1", { pinnedAt: null })

    expect(next[0]?.items[0]?.pinnedAt).toBeNull()
    expect(next[0]?.pins?.[0]?.pinnedAt).toBeNull()
    expect(next[1]).toBe(pages[1])
  })

  it("returns the same reference when the message is nowhere in the pages", () => {
    const pages = [page([msg({ id: "m1", createdAt: at(1) })])]
    expect(patchMessageInPages(pages, "missing", { body: "x" })).toBe(pages)
  })
})

describe("shouldResetToNewestPage (gap-fill beyond one page)", () => {
  const cached = [page([msg({ id: "m1", createdAt: at(1) })], "older")]

  it("resets when the fetched newest page shares ZERO ids with the cache AND has more below it", () => {
    const fetched = page([msg({ id: "m9", createdAt: at(9) })], "cursor-below-gap")
    expect(shouldResetToNewestPage(cached, fetched)).toBe(true)
  })

  it("folds when any fetched id overlaps the cache (contiguous, no gap)", () => {
    const fetched = page(
      [msg({ id: "m1", createdAt: at(1) }), msg({ id: "m2", createdAt: at(2) })],
      "cursor",
    )
    expect(shouldResetToNewestPage(cached, fetched)).toBe(false)
  })

  it("folds when the fetched page IS the complete history (no nextCursor => nothing below to lose)", () => {
    const fetched = page([msg({ id: "m9", createdAt: at(9) })], null)
    expect(shouldResetToNewestPage(cached, fetched)).toBe(false)
  })

  it("folds when the fetched page is empty", () => {
    expect(shouldResetToNewestPage(cached, page([], "cursor"))).toBe(false)
  })

  it("resets an all-empty cache onto a full fetched page so its cursor becomes the pagination root", () => {
    expect(shouldResetToNewestPage([page([])], page([msg({ id: "m9", createdAt: at(9) })], "c"))).toBe(
      true,
    )
  })
})

describe("applyHistoryCacheOps newestPage op", () => {
  it("a >PAGE_SIZE gap resets the query to just the fetched page; older history re-pages on demand", () => {
    const data: HistoryCacheData = {
      pages: [
        page([msg({ id: "m2", createdAt: at(2) })], "older-2"),
        page([msg({ id: "m1", createdAt: at(1) })], "older-1"),
      ],
      pageParams: [undefined, "older-2"],
    }
    const fetched = page([msg({ id: "m9", createdAt: at(9) })], "cursor-below-gap")

    const next = applyHistoryCacheOps(data, [{ kind: "newestPage", page: fetched }])

    expect(next.pages).toEqual([fetched])
    expect(next.pageParams).toEqual([undefined])
  })

  it("a small overlapping gap folds into the existing pages without touching pageParams", () => {
    const data: HistoryCacheData = {
      pages: [page([msg({ id: "m1", createdAt: at(1) })], "older")],
      pageParams: [undefined],
    }
    const fetched = page(
      [msg({ id: "m1", createdAt: at(1) }), msg({ id: "m2", createdAt: at(2) })],
      "cursor",
    )

    const next = applyHistoryCacheOps(data, [{ kind: "newestPage", page: fetched }])

    expect(next.pages[0]?.items.map((m) => m.id)).toEqual(["m1", "m2"])
    expect(next.pageParams).toBe(data.pageParams)
  })
})
