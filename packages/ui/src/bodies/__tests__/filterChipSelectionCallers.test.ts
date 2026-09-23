/**
 * APP-A11Y-012 callers: FilterChip defaults to radio semantics. The announce slot picker is a MULTI-select
 * and the slot editor's split-count and suggest-general chips are plain actions, so each names its role.
 * These bodies import react-native, which the node test environment cannot load, so the guard is scoped
 * to the exact chip element.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

function chipWith(source: string, marker: string): string {
  const at = source.indexOf(marker)
  expect(at, `${marker} is gone - re-scope the guard`).toBeGreaterThan(-1)
  const start = source.lastIndexOf("<FilterChip", at)
  return source.slice(start, source.indexOf("/>", at))
}

describe("FilterChip callers declare their selection semantics", () => {
  it("announce slot picker is a multi-select", () => {
    const chip = chipWith(read("../host/HostAnnounceBody.tsx"), "onPress={() => toggleSlot(slot.id)}")
    expect(chip).toContain('selection="multiple"')
  })

  it("slot editor split-count and suggest-general chips are actions", () => {
    const editor = read("../SlotEditor.tsx")
    expect(chipWith(editor, "onPress={() => onSplit(count)}")).toContain('selection="action"')
    expect(chipWith(editor, "onPress={onSuggestGeneral}")).toContain('selection="action"')
  })
})
