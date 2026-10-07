/**
 * A PopoverMenu row normally closes the menu and runs its action once the menu is gone. A row that
 * changes the menu itself (loading the next page of rows) sets `keepOpen`: it runs at once and the menu
 * stays up, on every platform, including iOS where a closing row's action is parked until the Modal
 * has dismissed.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import { makeOverlayActionGate } from "../overlayActionGate"
import { pressPopoverMenuItem } from "../popoverMenuModel"

function menu(deferUntilClosed: boolean) {
  const gate = makeOverlayActionGate(deferUntilClosed)
  const onClose = vi.fn()
  const run = (action: () => void) => {
    onClose()
    gate.choose(action)
  }
  return { gate, onClose, run }
}

describe("pressPopoverMenuItem", () => {
  it.each([true, false])("closes the menu for an ordinary row (deferUntilClosed %s)", (defer) => {
    const { gate, onClose, run } = menu(defer)
    const onPress = vi.fn()
    pressPopoverMenuItem({ onPress }, run)
    expect(onClose).toHaveBeenCalledTimes(1)
    gate.settle()
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it.each([true, false])("runs a keepOpen row at once and leaves the menu open (deferUntilClosed %s)", (defer) => {
    const { gate, onClose, run } = menu(defer)
    const onPress = vi.fn()
    pressPopoverMenuItem({ onPress, keepOpen: true }, run)
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(gate.hasPending()).toBe(false)
  })
})

describe("PopoverMenu presses rows through the model", () => {
  it("routes every row press through pressPopoverMenuItem with the deferred-close runner", () => {
    const popover = readFileSync(new URL("../PopoverMenu.tsx", import.meta.url), "utf8")
    expect(popover).toContain("keepOpen?: boolean")
    expect(popover).toMatch(
      /const handlePress = useCallback\(\(item: PopoverMenuItem\) => pressPopoverMenuItem\(item, run\), \[run\]\)/,
    )
    expect(popover).toContain("onPress={() => handlePress(item)}")
  })
})
