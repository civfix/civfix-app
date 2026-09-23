import { describe, expect, it } from "vitest"
import { MESSAGE_BODY_MAX, type MessageThreadDTO, type PersonDTO } from "@civfix/shared"
import {
  SHARE_CLIENT_ID_MAX,
  SHARE_DM_MAX_RECIPIENTS,
  applyRecipientChange,
  buildSharePlan,
  clampShareNote,
  composeShareBody,
  dmThreadIdsByPeer,
  recentDmPeers,
  recipientNames,
  retryEntries,
  shareNoteMaxLength,
  summarizeShareRun,
  toShareRecipient,
  type ShareDeliveryOutcome,
} from "../shareToDm"

const person = (id: string, over: Partial<PersonDTO> = {}): PersonDTO => ({
  id,
  name: `Name ${id}`,
  handle: id,
  avatar: null,
  avatarUrl: null,
  followers: 0,
  following: 0,
  isFollowing: false,
  ...over,
})

const thread = (over: Partial<MessageThreadDTO>): MessageThreadDTO =>
  ({
    id: "t",
    kind: "dm",
    title: "t",
    unread: 0,
    members: 2,
    lastFromMe: false,
    ...over,
  }) as MessageThreadDTO

const URL = "https://civfix.org/post/p1"

describe("the per-share recipient cap", () => {
  it("is ten, which keeps one share inside the 20/min openDm budget", () => {
    expect(SHARE_DM_MAX_RECIPIENTS).toBe(10)
  })

  it("refuses a change that would exceed the cap WHOLE, rather than truncating it silently", () => {
    const current = [person("a"), person("b")]
    const next = [...current, person("c")]
    expect(applyRecipientChange(current, next, 2)).toEqual({ recipients: current, rejected: true })
    expect(applyRecipientChange(current, next, 3)).toEqual({ recipients: next, rejected: false })
  })

  it("always lets a DESELECTION through, even from a selection already over the cap", () => {
    const current = [person("a"), person("b"), person("c")]
    const next = [person("a"), person("b")]
    expect(applyRecipientChange(current, next, 2)).toEqual({ recipients: next, rejected: false })
  })

  it("hands back copies, so the caller cannot mutate the picker's array", () => {
    const next = [person("a")]
    expect(applyRecipientChange([], next).recipients).not.toBe(next)
  })
})

describe("the message body a share sends", () => {
  it("is the link alone when there is no note", () => {
    expect(composeShareBody("", URL)).toBe(URL)
    expect(composeShareBody("   \n ", URL)).toBe(URL)
  })

  it("puts a trimmed note above the link, on its own line", () => {
    expect(composeShareBody("  look at this  ", URL)).toBe(`look at this\n${URL}`)
  })

  it("budgets the note so note + newline + link can never exceed the frame's body cap", () => {
    const max = shareNoteMaxLength(URL)
    expect(max).toBe(MESSAGE_BODY_MAX - URL.length - 1)
    expect(composeShareBody("x".repeat(max), URL).length).toBe(MESSAGE_BODY_MAX)
  })

  it("never reports a negative budget for an absurdly long link", () => {
    expect(shareNoteMaxLength("https://civfix.org/".padEnd(MESSAGE_BODY_MAX + 50, "x"))).toBe(0)
  })

  it("keeps a note that fits untouched", () => {
    expect(clampShareNote("hi 👋", 10)).toBe("hi 👋")
  })

  it("never cuts an emoji in half at the cap, which would send a lone surrogate", () => {
    const clamped = clampShareNote("ab👋cd", 3)
    expect(clamped).toBe("ab")
    expect(clamped).not.toMatch(/[\uD800-\uDBFF]$/)
  })

  it("keeps a whole emoji that ends exactly on the cap", () => {
    expect(clampShareNote("ab👋cd", 4)).toBe("ab👋")
  })

  it("cuts plain text at the cap", () => {
    expect(clampShareNote("abcdef", 3)).toBe("abc")
    expect(clampShareNote("abc", 0)).toBe("")
  })
})

describe("buildSharePlan", () => {
  const ids = (n: number): string => `cid-${n}`

  it("mints one clientId per recipient, in order", () => {
    const plan = buildSharePlan([person("a"), person("b")].map(toShareRecipient), ids)
    expect(plan).toEqual([
      { recipient: { id: "a", name: "Name a" }, clientId: "cid-0" },
      { recipient: { id: "b", name: "Name b" }, clientId: "cid-1" },
    ])
  })

  it("dedupes by recipient id, so one person can never be sent to twice", () => {
    const plan = buildSharePlan(
      [person("a"), person("a"), person("b")].map(toShareRecipient),
      ids,
    )
    expect(plan.map((entry) => entry.recipient.id)).toEqual(["a", "b"])
  })

  it("stops at the cap and drops an empty id", () => {
    const many = Array.from({ length: 14 }, (_, i) => toShareRecipient(person(`p${i}`)))
    expect(buildSharePlan(many, ids)).toHaveLength(SHARE_DM_MAX_RECIPIENTS)
    expect(buildSharePlan([toShareRecipient(person(""))], ids)).toEqual([])
  })

  it("clamps a clientId to the 64 characters the socket frame accepts", () => {
    const plan = buildSharePlan([toShareRecipient(person("a"))], () => "z".repeat(200))
    expect(plan[0]?.clientId).toHaveLength(SHARE_CLIENT_ID_MAX)
  })
})

describe("summarizeShareRun", () => {
  const plan = buildSharePlan(
    [person("a"), person("b"), person("c")].map(toShareRecipient),
    (i) => `cid-${i}`,
  )
  const outcomes = (...values: ShareDeliveryOutcome[]): Map<string, ShareDeliveryOutcome> =>
    new Map(values.map((value, i) => [`cid-${i}`, value]))

  it("reports a fully delivered run", () => {
    const summary = summarizeShareRun(plan, outcomes("sent", "sent", "sent"))
    expect(summary.status).toBe("all")
    expect(summary.failed).toEqual([])
    expect(summary.sent.map((r) => r.id)).toEqual(["a", "b", "c"])
  })

  it("reports a partial run and names who missed out", () => {
    const summary = summarizeShareRun(plan, outcomes("sent", "failed", "sent"))
    expect(summary.status).toBe("partial")
    expect(summary.failed.map((r) => r.id)).toEqual(["b"])
    expect(recipientNames(summary.failed)).toBe("Name b")
  })

  it("counts a MISSING outcome as a failure, never as a silent success", () => {
    const summary = summarizeShareRun(plan, new Map())
    expect(summary.status).toBe("none")
    expect(summary.failed).toHaveLength(3)
  })

  it("calls an empty plan 'none', not 'all'", () => {
    expect(summarizeShareRun([], new Map()).status).toBe("none")
  })

  it("carries whether the run stopped early, defaulting to false", () => {
    expect(summarizeShareRun(plan, outcomes("sent", "sent", "sent")).stopped).toBe(false)
    expect(summarizeShareRun(plan, outcomes("sent"), true)).toMatchObject({
      status: "partial",
      stopped: true,
    })
  })
})

describe("retryEntries", () => {
  it("retries the failures with the SAME clientIds, so the server dedupes a double send", () => {
    const plan = buildSharePlan(
      [person("a"), person("b"), person("c")].map(toShareRecipient),
      (i) => `cid-${i}`,
    )
    const summary = summarizeShareRun(
      plan,
      new Map([
        ["cid-0", "sent" as const],
        ["cid-1", "failed" as const],
        ["cid-2", "failed" as const],
      ]),
    )
    const retry = retryEntries(plan, summary.failed)
    expect(retry).toEqual([plan[1], plan[2]])
    expect(retry.map((entry) => entry.clientId)).toEqual(["cid-1", "cid-2"])
  })

  it("is empty when nothing failed", () => {
    const plan = buildSharePlan([toShareRecipient(person("a"))], (i) => `cid-${i}`)
    expect(retryEntries(plan, [])).toEqual([])
  })
})

describe("dmThreadIdsByPeer", () => {
  it("maps each DM peer to the room id the thread already knows, so no second openDm is needed", () => {
    const pages = [
      { items: [thread({ id: "t1", refId: "room-a", peer: person("a") })] },
      { items: [thread({ id: "t2", peer: person("b") }), thread({ id: "t3", refId: "room-a2", peer: person("a") })] },
    ]
    const byPeer = dmThreadIdsByPeer(pages)
    expect(byPeer.get("a")).toBe("room-a")
    expect(byPeer.get("b")).toBe("t2")
    expect(byPeer.size).toBe(2)
  })

  it("ignores non-DM and peerless threads, and tolerates absent pages", () => {
    const pages = [
      { items: [thread({ id: "g", kind: "group", peer: person("g") }), thread({ id: "n", peer: null })] },
    ]
    expect(dmThreadIdsByPeer(pages).size).toBe(0)
    expect(dmThreadIdsByPeer(undefined).size).toBe(0)
  })
})

describe("recentDmPeers", () => {
  it("collects DM peers newest-first across pages, deduped", () => {
    const pages = [
      { items: [thread({ id: "t1", peer: person("a") }), thread({ id: "t2", peer: person("b") })] },
      { items: [thread({ id: "t3", peer: person("a") }), thread({ id: "t4", peer: person("c") })] },
    ]
    expect(recentDmPeers(pages).map((p) => p.id)).toEqual(["a", "b", "c"])
  })

  it("skips non-DM threads, peerless threads and deleted accounts", () => {
    const pages = [
      {
        items: [
          thread({ id: "g", kind: "group", peer: person("g") }),
          thread({ id: "n", peer: null }),
          thread({ id: "d", peer: person("d", { deleted: true }) }),
          thread({ id: "ok", peer: person("ok") }),
        ],
      },
    ]
    expect(recentDmPeers(pages).map((p) => p.id)).toEqual(["ok"])
  })

  it("honours the limit and tolerates absent pages", () => {
    const pages = [{ items: [thread({ id: "t1", peer: person("a") }), thread({ id: "t2", peer: person("b") })] }]
    expect(recentDmPeers(pages, 1).map((p) => p.id)).toEqual(["a"])
    expect(recentDmPeers(undefined)).toEqual([])
    expect(recentDmPeers([{ items: null }])).toEqual([])
  })
})
