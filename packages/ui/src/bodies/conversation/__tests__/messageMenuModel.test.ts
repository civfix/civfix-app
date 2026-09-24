import { describe, expect, it, vi } from "vitest"
import type { LucideIcon } from "../../../typography"
import type { MessageActionKey } from "../../messageActions"
import { messageMenuModel, type MessageMenuInput } from "../messageMenuModel"

const KEYS: MessageActionKey[] = [
  "reply",
  "copy",
  "edit",
  "pin",
  "unpin",
  "jump",
  "delete",
  "report",
  "block",
  "retractVote",
  "stopPoll",
]

function input(overrides: Partial<MessageMenuInput> = {}): MessageMenuInput {
  const labels = Object.fromEntries(KEYS.map((key) => [key, `label:${key}`])) as Record<MessageActionKey, string>
  const icons = Object.fromEntries(KEYS.map((key) => [key, { key } as unknown as LucideIcon])) as Record<
    MessageActionKey,
    LucideIcon
  >
  const press = Object.fromEntries(KEYS.map((key) => [key, vi.fn()])) as unknown as Record<MessageActionKey, () => void>
  return {
    descriptors: [
      { key: "reply", destructive: false },
      { key: "delete", destructive: true },
    ],
    labels,
    icons,
    press,
    confirm: {
      cancelLabel: "Cancel",
      deleteLabel: "Delete message",
      stopLabel: "Stop poll",
      onDelete: vi.fn(),
      onStop: vi.fn(),
    },
    ...overrides,
  }
}

describe("messageMenuModel", () => {
  it("maps each descriptor, in order, to its label, icon, tone and handler", () => {
    const i = input()
    const { menuActions } = messageMenuModel(i)
    expect(menuActions.map((a) => [a.key, a.label, a.destructive])).toEqual([
      ["reply", "label:reply", false],
      ["delete", "label:delete", true],
    ])
    expect(menuActions[0]?.icon).toBe(i.icons.reply)
    expect(menuActions[1]?.onPress).toBe(i.press.delete)
  })

  it("renders no rows for an empty descriptor list", () => {
    expect(messageMenuModel(input({ descriptors: [] })).menuActions).toEqual([])
  })

  it("puts Cancel first and the destructive delete confirm second", () => {
    const i = input()
    const { confirmItems } = messageMenuModel(i)
    expect(confirmItems.map((item) => [item.key, item.label, item.icon, item.destructive])).toEqual([
      ["cancel", "Cancel", undefined, undefined],
      ["confirm-delete", "Delete message", "Trash2", true],
    ])
    confirmItems[1]?.onPress()
    expect(i.confirm.onDelete).toHaveBeenCalledTimes(1)
  })

  it("confirms a poll stop with a non-destructive Lock row", () => {
    const i = input()
    const { stopConfirmItems } = messageMenuModel(i)
    expect(stopConfirmItems.map((item) => [item.key, item.label, item.icon, item.destructive])).toEqual([
      ["cancel", "Cancel", undefined, undefined],
      ["confirm-stop", "Stop poll", "Lock", undefined],
    ])
    stopConfirmItems[0]?.onPress()
    expect(i.confirm.onStop).not.toHaveBeenCalled()
    stopConfirmItems[1]?.onPress()
    expect(i.confirm.onStop).toHaveBeenCalledTimes(1)
  })
})
