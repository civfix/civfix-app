import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "../__testing__/harness"
import { BulkBar } from "./bulk-bar"
import { SavedTabs } from "./saved-tabs"

afterEach(cleanup)

function descriptionOf(el: HTMLElement): string {
  return (el.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ")
}

describe("SavedTabs", () => {
  it("is a group of pressed toggles, not a tablist without tab panels", () => {
    renderConsole(
      <SavedTabs
        label="Views"
        activeId="all"
        onChange={() => {}}
        tabs={[
          { id: "all", label: "All" },
          { id: "late", label: "Late" },
        ]}
      />,
    )
    expect(screen.queryByRole("tablist")).toBeNull()
    screen.getByRole("group", { name: "Views" })
    expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true")
    expect(screen.getByRole("button", { name: "Late" }).getAttribute("aria-pressed")).toBe("false")
  })

  it("keeps a disabled view focusable with its reason as a description", () => {
    const onChange = vi.fn()
    renderConsole(
      <SavedTabs
        label="Views"
        activeId="all"
        onChange={onChange}
        tabs={[
          { id: "all", label: "All" },
          { id: "wait", label: "Waitlist", disabled: true, disabledReason: "Waitlist is off" },
        ]}
      />,
    )
    const tab = screen.getByRole("button", { name: "Waitlist" })
    expect(tab.hasAttribute("disabled")).toBe(false)
    expect(tab.getAttribute("aria-disabled")).toBe("true")
    expect(descriptionOf(tab)).toBe("Waitlist is off")
    fireEvent.click(tab)
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe("BulkBar", () => {
  it("keeps a disabled action focusable with its reason as a description", () => {
    const onPress = vi.fn()
    renderConsole(
      <BulkBar
        count={2}
        onClear={() => {}}
        actions={[
          { id: "remove", label: "Remove", disabled: true, disabledReason: "Event has ended", onPress },
        ]}
      />,
    )
    const remove = screen.getByRole("button", { name: "Remove" })
    expect(remove.hasAttribute("disabled")).toBe(false)
    expect(remove.getAttribute("aria-disabled")).toBe("true")
    expect(descriptionOf(remove)).toBe("Event has ended")
    fireEvent.click(remove)
    expect(onPress).not.toHaveBeenCalled()
  })
})
