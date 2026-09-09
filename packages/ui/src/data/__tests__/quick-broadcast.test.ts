import { describe, expect, it, vi } from "vitest"
import { AppError } from "@civfix/shared"
import type { BroadcastDTO, BroadcastStatus } from "@civfix/shared"
import {
  broadcastFanoutStarted,
  discardQuickBroadcast,
  sameQuickBroadcastVars,
  sendQuickBroadcast,
} from "../hooks/host"
import type { QuickBroadcastPorts, QuickBroadcastVars, RetainedQuickDraft } from "../hooks/host"

const VARS: QuickBroadcastVars = {
  subject: "Doors are open",
  bodyMd: "Come to the north gate.",
  segment: { kind: "all_registered" },
}

const EDITED: QuickBroadcastVars = {
  subject: "Doors are open",
  bodyMd: "Come to the SOUTH gate.",
  segment: { kind: "waitlist" },
}

const RETAINED: RetainedQuickDraft = { id: "b1", vars: VARS }

function dto(status: BroadcastStatus): BroadcastDTO {
  return { id: "b1", status } as unknown as BroadcastDTO
}

function ports(overrides: Partial<QuickBroadcastPorts> = {}) {
  const retained: RetainedQuickDraft[] = []
  const base: QuickBroadcastPorts = {
    createDraft: vi.fn(async () => ({ id: "b1" })),
    update: vi.fn(async () => dto("draft")),
    send: vi.fn(async () => dto("sending")),
    read: vi.fn(async () => dto("sending")),
    discard: vi.fn(async () => {}),
    retainDraft: (draft: RetainedQuickDraft) => {
      retained.push(draft)
    },
    ...overrides,
  }
  return { ports: base, retained }
}

describe("sendQuickBroadcast", () => {
  it("creates the draft once and sends it", async () => {
    const { ports: p, retained } = ports()
    const result = await sendQuickBroadcast(p, VARS, null)
    expect(result).toMatchObject({ kind: "sent", broadcast: { status: "sending" } })
    expect(p.createDraft).toHaveBeenCalledTimes(1)
    expect(p.send).toHaveBeenCalledWith("b1")
    expect(p.update).not.toHaveBeenCalled()
    expect(retained).toEqual([RETAINED])
  })

  it("retries the SAME draft instead of blasting every attendee twice", async () => {
    const { ports: p } = ports()
    await sendQuickBroadcast(p, VARS, RETAINED)
    expect(p.createDraft).not.toHaveBeenCalled()
    expect(p.update).not.toHaveBeenCalled()
    expect(p.send).toHaveBeenCalledWith("b1")
  })

  it("writes the host's EDITS onto the retained draft before re-sending it", async () => {
    const { ports: p, retained } = ports()
    const result = await sendQuickBroadcast(p, EDITED, RETAINED)
    expect(result.kind).toBe("sent")
    expect(p.createDraft).not.toHaveBeenCalled()
    expect(p.update).toHaveBeenCalledWith("b1", EDITED)
    expect(p.send).toHaveBeenCalledWith("b1")
    expect(retained).toEqual([{ id: "b1", vars: EDITED }])
    const updatedAt = (p.update as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0] ?? 0
    const sentAt = (p.send as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0] ?? 0
    expect(updatedAt).toBeLessThan(sentAt)
  })

  it("surfaces edits that were LOST because the earlier text already went out", async () => {
    const { ports: p } = ports({
      update: vi.fn(async () => {
        throw AppError.conflict("That message is already sending.")
      }),
      read: vi.fn(async () => dto("sent")),
    })
    const result = await sendQuickBroadcast(p, EDITED, RETAINED)
    expect(result).toEqual({ kind: "edits_lost", broadcast: dto("sent") })
    expect(p.send).not.toHaveBeenCalled()
  })

  it("does NOT swallow an update conflict on a draft that never started", async () => {
    const conflict = AppError.conflict("That message has no content to send.")
    const { ports: p } = ports({
      update: vi.fn(async () => {
        throw conflict
      }),
      read: vi.fn(async () => dto("draft")),
    })
    await expect(sendQuickBroadcast(p, EDITED, RETAINED)).rejects.toBe(conflict)
    expect(p.send).not.toHaveBeenCalled()
  })

  it("reads the server's CONFLICT on an already-sending draft as the lost success", async () => {
    const { ports: p } = ports({
      send: vi.fn(async () => {
        throw AppError.conflict("That message is already sending.")
      }),
      read: vi.fn(async () => dto("sending")),
    })
    await expect(sendQuickBroadcast(p, VARS, RETAINED)).resolves.toMatchObject({
      kind: "sent",
      broadcast: { status: "sending" },
    })
  })

  it("also accepts a draft that has already finished sending", async () => {
    const { ports: p } = ports({
      send: vi.fn(async () => {
        throw AppError.conflict("already sending")
      }),
      read: vi.fn(async () => dto("sent")),
    })
    await expect(sendQuickBroadcast(p, VARS, RETAINED)).resolves.toMatchObject({
      kind: "sent",
      broadcast: { status: "sent" },
    })
  })

  it("does NOT swallow a conflict whose fan-out never started", async () => {
    const conflict = AppError.conflict("That message has no content to send.")
    const { ports: p } = ports({
      send: vi.fn(async () => {
        throw conflict
      }),
      read: vi.fn(async () => dto("draft")),
    })
    await expect(sendQuickBroadcast(p, VARS, RETAINED)).rejects.toBe(conflict)
  })

  it("never re-reads on a non-conflict failure", async () => {
    const boom = AppError.rateLimited("slow down")
    const { ports: p } = ports({
      send: vi.fn(async () => {
        throw boom
      }),
    })
    await expect(sendQuickBroadcast(p, VARS, null)).rejects.toBe(boom)
    expect(p.read).not.toHaveBeenCalled()
  })

  it("never re-reads on a non-conflict update failure", async () => {
    const boom = AppError.rateLimited("slow down")
    const { ports: p } = ports({
      update: vi.fn(async () => {
        throw boom
      }),
    })
    await expect(sendQuickBroadcast(p, EDITED, RETAINED)).rejects.toBe(boom)
    expect(p.read).not.toHaveBeenCalled()
    expect(p.send).not.toHaveBeenCalled()
  })

  it("retains the draft with its content even when the first send fails", async () => {
    const { ports: p, retained } = ports({
      send: vi.fn(async () => {
        throw AppError.internal("lost")
      }),
    })
    await expect(sendQuickBroadcast(p, VARS, null)).rejects.toBeInstanceOf(AppError)
    expect(retained).toEqual([RETAINED])
  })
})

describe("discardQuickBroadcast", () => {
  it("deletes the retained draft", async () => {
    const { ports: p } = ports()
    await expect(discardQuickBroadcast(p, "b1")).resolves.toEqual({ kind: "discarded" })
    expect(p.discard).toHaveBeenCalledWith("b1")
  })

  it("reports a draft that already started sending instead of claiming it was discarded", async () => {
    const { ports: p } = ports({
      discard: vi.fn(async () => {
        throw AppError.conflict("That message is already sending.")
      }),
    })
    await expect(discardQuickBroadcast(p, "b1")).resolves.toEqual({ kind: "already_sending" })
  })

  it("treats a draft that is already gone as discarded so the composer releases it", async () => {
    const { ports: p } = ports({
      discard: vi.fn(async () => {
        throw AppError.notFound("That draft no longer exists.")
      }),
    })
    await expect(discardQuickBroadcast(p, "b1")).resolves.toEqual({ kind: "discarded" })
  })

  it("does not swallow a real failure", async () => {
    const boom = AppError.internal("nope")
    const { ports: p } = ports({
      discard: vi.fn(async () => {
        throw boom
      }),
    })
    await expect(discardQuickBroadcast(p, "b1")).rejects.toBe(boom)
  })
})

describe("sameQuickBroadcastVars", () => {
  it("is true only when subject, body and audience all match", () => {
    expect(sameQuickBroadcastVars(VARS, { ...VARS })).toBe(true)
    expect(sameQuickBroadcastVars(VARS, { ...VARS, subject: "Gate B" })).toBe(false)
    expect(sameQuickBroadcastVars(VARS, { ...VARS, bodyMd: "other" })).toBe(false)
    expect(sameQuickBroadcastVars(VARS, { ...VARS, segment: { kind: "checked_in" } })).toBe(false)
  })

  it("compares the ids of a list-shaped audience", () => {
    const a: QuickBroadcastVars = { ...VARS, segment: { kind: "ticket_types", ids: ["t1", "t2"] } }
    const b: QuickBroadcastVars = { ...VARS, segment: { kind: "ticket_types", ids: ["t1", "t2"] } }
    const c: QuickBroadcastVars = { ...VARS, segment: { kind: "ticket_types", ids: ["t1"] } }
    expect(sameQuickBroadcastVars(a, b)).toBe(true)
    expect(sameQuickBroadcastVars(a, c)).toBe(false)
  })
})

describe("broadcastFanoutStarted", () => {
  it("is true only once the fan-out is under way", () => {
    expect(broadcastFanoutStarted("sending")).toBe(true)
    expect(broadcastFanoutStarted("sent")).toBe(true)
    expect(broadcastFanoutStarted("draft")).toBe(false)
    expect(broadcastFanoutStarted("scheduled")).toBe(false)
    expect(broadcastFanoutStarted("cancelled")).toBe(false)
    expect(broadcastFanoutStarted("failed")).toBe(false)
  })
})
