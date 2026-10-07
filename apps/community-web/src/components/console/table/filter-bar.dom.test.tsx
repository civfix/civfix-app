import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "../__testing__/harness"
import { FilterBar } from "./filter-bar"

afterEach(cleanup)

describe("FilterBar", () => {
  it("wires a facet trigger to the popover it opens", async () => {
    const user = userEvent.setup()
    renderConsole(
      <FilterBar
        facets={[
          {
            id: "ticket",
            label: "Ticket",
            kind: "multi",
            options: [{ value: "t1", label: "General" }],
            values: [],
            onChange: () => {},
          },
        ]}
      />,
    )
    const trigger = screen.getByRole("button", { name: "Ticket" })
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog")
    await user.click(trigger)
    const panel = screen.getByRole("dialog", { name: "Ticket" })
    expect(trigger.getAttribute("aria-controls")).toBe(panel.id)
    expect(panel.contains(document.activeElement)).toBe(true)
  })

  it("gives the remove-filter control a 24px target", () => {
    renderConsole(
      <FilterBar
        facets={[{ id: "late", label: "Late", kind: "search", value: "yes", onChange: () => {} }]}
      />,
    )
    const remove = screen.getByRole("button", { name: "filter.remove_chip(label=Late: yes)" })
    expect(remove.className).toMatch(/\bh-6\b/)
    expect(remove.className).toMatch(/\bw-6\b/)
  })
})
