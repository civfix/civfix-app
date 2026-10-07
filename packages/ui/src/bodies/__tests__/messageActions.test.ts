import { describe, expect, it } from "vitest"
import { buildMessageActions, isBlockableAuthor, type MessageActionsInput } from "../messageActions"

/** A delivered, copyable, replyable baseline; each case overrides what it is about. */
function input(overrides: Partial<MessageActionsInput> = {}): MessageActionsInput {
  return {
    mine: false,
    isSystem: false,
    isGroupRoom: false,
    pendingOrFailed: false,
    deleted: false,
    hasMessageId: true,
    hasBody: true,
    hasClipboard: true,
    canEdit: false,
    canDelete: false,
    canPin: false,
    isPinned: false,
    canDeleteOthers: false,
    authorBlockable: true,
    canReply: true,
    ...overrides,
  }
}

const keys = (i: MessageActionsInput) => buildMessageActions(i).map((a) => a.key)

describe("buildMessageActions", () => {
  it("own editable text message: reply, copy, edit, delete", () => {
    expect(keys(input({ mine: true, canEdit: true, canDelete: true }))).toEqual([
      "reply",
      "copy",
      "edit",
      "delete",
    ])
  })

  it("other's message in a group room: reply, copy, report, block", () => {
    expect(keys(input({ isGroupRoom: true }))).toEqual(["reply", "copy", "report", "block"])
  })

  it("own message in a group room never grows report/block", () => {
    expect(keys(input({ mine: true, canEdit: true, canDelete: true, isGroupRoom: true }))).toEqual([
      "reply",
      "copy",
      "edit",
      "delete",
    ])
  })

  it("other's message in a DM: reply, copy, report (never block)", () => {
    expect(keys(input({ isGroupRoom: false }))).toEqual(["reply", "copy", "report"])
  })

  it("reply leads the order (Telegram order)", () => {
    expect(keys(input({ mine: true, canEdit: true, canDelete: true }))[0]).toBe("reply")
    expect(keys(input({ isGroupRoom: true }))[0]).toBe("reply")
  })

  it("omits reply when the viewer cannot send in this room", () => {
    expect(keys(input({ canReply: false, mine: true, canEdit: true, canDelete: true }))).toEqual([
      "copy",
      "edit",
      "delete",
    ])
    expect(keys(input({ canReply: false, isGroupRoom: true }))).toEqual(["copy", "report", "block"])
  })

  it("system row: copy only, never reply, even in a group room", () => {
    expect(keys(input({ isSystem: true, isGroupRoom: true }))).toEqual(["copy"])
    expect(keys(input({ isSystem: true, mine: true, canEdit: true, canDelete: true }))).toEqual([
      "copy",
    ])
  })

  it("own pending/failed message: nothing", () => {
    expect(keys(input({ mine: true, canEdit: true, canDelete: true, pendingOrFailed: true }))).toEqual([])
  })

  it("deleted (tombstone) message: nothing", () => {
    expect(keys(input({ mine: true, canDelete: true, deleted: true }))).toEqual([])
    expect(keys(input({ isGroupRoom: true, deleted: true }))).toEqual([])
  })

  it("omits copy when there is no body (attachment-only); reply stays", () => {
    expect(keys(input({ mine: true, canDelete: true, hasBody: false }))).toEqual(["reply", "delete"])
    expect(keys(input({ isGroupRoom: true, hasBody: false }))).toEqual(["reply", "report", "block"])
  })

  it("omits copy when the host has no clipboard capability", () => {
    expect(keys(input({ mine: true, canEdit: true, canDelete: true, hasClipboard: false }))).toEqual([
      "reply",
      "edit",
      "delete",
    ])
    expect(keys(input({ isSystem: true, hasClipboard: false }))).toEqual([])
  })

  it("omits reply and report when the message has no server id", () => {
    // A reply reference must point at a persisted message, same as a report.
    expect(keys(input({ isGroupRoom: true, hasMessageId: false }))).toEqual(["copy", "block"])
  })

  it("omits block when the author is not blockable (deleted account)", () => {
    expect(keys(input({ isGroupRoom: true, authorBlockable: false }))).toEqual(["reply", "copy", "report"])
  })

  it("own non-editable message keeps delete without edit", () => {
    expect(keys(input({ mine: true, canEdit: false, canDelete: true }))).toEqual(["reply", "copy", "delete"])
  })

  it("pin shown for a pin-power holder (organizer) on others' messages, after copy", () => {
    expect(keys(input({ isGroupRoom: true, canPin: true }))).toEqual([
      "reply",
      "copy",
      "pin",
      "report",
      "block",
    ])
  })

  it("pin sits after edit and before delete on own messages", () => {
    expect(keys(input({ mine: true, canEdit: true, canDelete: true, canPin: true }))).toEqual([
      "reply",
      "copy",
      "edit",
      "pin",
      "delete",
    ])
  })

  it("unpin replaces pin when the message is already pinned", () => {
    expect(keys(input({ isGroupRoom: true, canPin: true, isPinned: true }))).toContain("unpin")
    expect(keys(input({ isGroupRoom: true, canPin: true, isPinned: true }))).not.toContain("pin")
  })

  it("regular member unchanged: no pin rows without the room power", () => {
    expect(keys(input({ isGroupRoom: true, isPinned: true }))).toEqual([
      "reply",
      "copy",
      "report",
      "block",
    ])
  })

  it("pin needs a server id and never shows on system rows", () => {
    expect(keys(input({ canPin: true, hasMessageId: false }))).not.toContain("pin")
    expect(keys(input({ canPin: true, isSystem: true }))).toEqual(["copy"])
  })

  it("pinned tombstones/pending rows still get nothing", () => {
    expect(keys(input({ canPin: true, deleted: true, isPinned: true }))).toEqual([])
    expect(keys(input({ canPin: true, pendingOrFailed: true }))).toEqual([])
  })

  it("moderator delete: offered on OTHERS' messages when canDeleteOthers, destructive, before report", () => {
    const rows = buildMessageActions(input({ isGroupRoom: true, canDeleteOthers: true }))
    expect(rows.map((a) => a.key)).toEqual(["reply", "copy", "delete", "report", "block"])
    expect(rows.find((a) => a.key === "delete")!.destructive).toBe(true)
  })

  it("moderator delete does not leak onto own messages (own canDelete governs there)", () => {
    expect(keys(input({ mine: true, canDelete: false, canDeleteOthers: true }))).toEqual([
      "reply",
      "copy",
    ])
  })

  it("organizer full house on others' rows: pin + moderator delete together", () => {
    expect(keys(input({ isGroupRoom: true, canPin: true, canDeleteOthers: true }))).toEqual([
      "reply",
      "copy",
      "pin",
      "delete",
      "report",
      "block",
    ])
  })

  it("poll (others', open, not voted): reply then stopPoll only for a moderator, no copy/edit", () => {
    expect(keys(input({ isGroupRoom: true, isPoll: true, hasBody: false }))).toEqual([
      "reply",
      "report",
      "block",
    ])
  })

  it("poll: retractVote shows only when the viewer has voted and the poll is open", () => {
    expect(keys(input({ isPoll: true, hasBody: false, hasVoted: true }))).toContain("retractVote")
    expect(keys(input({ isPoll: true, hasBody: false, hasVoted: true, pollClosed: true }))).not.toContain(
      "retractVote",
    )
    expect(keys(input({ isPoll: true, hasBody: false, hasVoted: false }))).not.toContain("retractVote")
  })

  it("poll: stopPoll shows for the author (mine) or a room moderator, only while open", () => {
    expect(keys(input({ isPoll: true, hasBody: false, mine: true }))).toContain("stopPoll")
    expect(keys(input({ isPoll: true, hasBody: false, canModeratePoll: true }))).toContain("stopPoll")
    expect(keys(input({ isPoll: true, hasBody: false }))).not.toContain("stopPoll")
    expect(keys(input({ isPoll: true, hasBody: false, mine: true, pollClosed: true }))).not.toContain(
      "stopPoll",
    )
  })

  it("poll never offers copy or edit, even with a body and edit rights", () => {
    const rows = keys(
      input({ isPoll: true, mine: true, hasBody: true, canEdit: true, canDelete: true, hasVoted: true }),
    )
    expect(rows).not.toContain("copy")
    expect(rows).not.toContain("edit")
    expect(rows).toEqual(["reply", "retractVote", "stopPoll", "delete"])
  })

  it("poll rows need a server id (they call the poll endpoints)", () => {
    expect(keys(input({ isPoll: true, hasBody: false, hasVoted: true, mine: true, hasMessageId: false }))).not.toContain(
      "retractVote",
    )
    expect(keys(input({ isPoll: true, hasBody: false, mine: true, hasMessageId: false }))).not.toContain(
      "stopPoll",
    )
  })

  it("flags delete and block as destructive, others not", () => {
    const own = buildMessageActions(input({ mine: true, canEdit: true, canDelete: true }))
    expect(own).toEqual([
      { key: "reply", destructive: false },
      { key: "copy", destructive: false },
      { key: "edit", destructive: false },
      { key: "delete", destructive: true },
    ])
    const theirs = buildMessageActions(input({ isGroupRoom: true }))
    expect(theirs).toEqual([
      { key: "reply", destructive: false },
      { key: "copy", destructive: false },
      { key: "report", destructive: false },
      { key: "block", destructive: true },
    ])
  })
})

describe("buildMessageActions - pinnedOnlyView (the pinned-messages list)", () => {
  /** The pinned-view baseline: a delivered pinned row seen by a viewer WITHOUT the pin power. */
  const pinned = (overrides: Partial<MessageActionsInput> = {}): MessageActionsInput =>
    input({ pinnedOnlyView: true, isPinned: true, canPin: false, ...overrides })

  it("without the pin power: jump + copy only (unpin is rights-gated)", () => {
    expect(keys(pinned())).toEqual(["jump", "copy"])
  })

  it("with the pin power: jump, copy, unpin - in that fixed order, nothing destructive", () => {
    const rows = buildMessageActions(pinned({ canPin: true }))
    expect(rows).toEqual([
      { key: "jump", destructive: false },
      { key: "copy", destructive: false },
      { key: "unpin", destructive: false },
    ])
  })

  it("NEVER offers thread-only actions, whatever the caller's live-thread rights say", () => {
    const maxed = pinned({
      mine: true,
      canEdit: true,
      canDelete: true,
      canDeleteOthers: true,
      canPin: true,
      canReply: true,
      isGroupRoom: true,
    })
    expect(keys(maxed)).toEqual(["jump", "copy", "unpin"])
  })

  it("attachment-only pins (no body) drop copy but keep jump/unpin", () => {
    expect(keys(pinned({ hasBody: false, canPin: true }))).toEqual(["jump", "unpin"])
  })

  it("no clipboard capability drops copy (same rule as the thread menu)", () => {
    expect(keys(pinned({ hasClipboard: false }))).toEqual(["jump"])
  })

  it("jump and unpin need a server id (defensive - pins are always server DTOs)", () => {
    expect(keys(pinned({ hasMessageId: false, canPin: true }))).toEqual(["copy"])
  })

  it("system rows keep copy only (belt-and-braces; they never open a menu)", () => {
    expect(keys(pinned({ isSystem: true, canPin: true }))).toEqual(["copy"])
  })

  it("deleted / pending rows still get NO menu at all", () => {
    expect(keys(pinned({ deleted: true }))).toEqual([])
    expect(keys(pinned({ pendingOrFailed: true }))).toEqual([])
  })

  it("pinnedOnlyView omitted or false leaves the live-thread matrix untouched", () => {
    expect(keys(input())).toEqual(["reply", "copy", "report"])
    expect(keys(input({ pinnedOnlyView: false }))).toEqual(["reply", "copy", "report"])
  })
})

describe("isBlockableAuthor", () => {
  const author = { id: "person-1" }

  it("a live account can be blocked", () => {
    expect(isBlockableAuthor(author)).toBe(true)
    expect(isBlockableAuthor({ ...author, deleted: false, official: false })).toBe(true)
  })

  it("the server-flagged official account never offers block", () => {
    expect(isBlockableAuthor({ ...author, official: true })).toBe(false)
    expect(keys(input({ isGroupRoom: true, authorBlockable: isBlockableAuthor({ ...author, official: true }) }))).toEqual([
      "reply",
      "copy",
      "report",
    ])
  })

  it("a deleted, id-less or missing author has nothing to block", () => {
    expect(isBlockableAuthor({ ...author, deleted: true })).toBe(false)
    expect(isBlockableAuthor({ id: "" })).toBe(false)
    expect(isBlockableAuthor(null)).toBe(false)
    expect(isBlockableAuthor(undefined)).toBe(false)
  })
})
