import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import type { EventPageBlock } from "@civfix/shared"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { BlockEditor } from "./block-editor"
import { replaceBlock, withRowKeys, type BlockIssue } from "./blocks"

function Harness({
  initial,
  errors,
}: {
  initial: EventPageBlock
  errors?: Record<string, BlockIssue>
}) {
  const [blocks, setBlocks] = useState(() => withRowKeys([initial]))
  const block = blocks[0]!
  return (
    <BlockEditor
      block={block}
      onChange={(patch) => setBlocks((current) => replaceBlock(current, block.id, patch))}
      errors={errors}
    />
  )
}

afterEach(() => {
  cleanup()
})

describe("BlockEditor list rows", () => {
  it("keeps a later row's field, and its focus, when a middle row is removed", () => {
    render(
      <Harness
        initial={{
          id: "agenda-1",
          kind: "agenda",
          items: [
            { title: "Check-in", time: null, description: null },
            { title: "Briefing", time: null, description: null },
            { title: "Cleanup", time: null, description: null },
          ],
        }}
      />,
    )
    const third = screen.getByDisplayValue("Cleanup")
    third.focus()
    fireEvent.change(third, { target: { value: "Cleanup crew" } })

    fireEvent.click(
      screen.getByRole("button", { name: "block.remove_row(label=block.agenda.item(n=2))" }),
    )

    expect(screen.queryByDisplayValue("Briefing")).toBeNull()
    expect(screen.getByDisplayValue("Cleanup crew")).toBe(third)
    expect(document.activeElement).toBe(third)
  })
})

describe("BlockEditor list row fields", () => {
  it("labels each row field with visible text and shows its error beside it", () => {
    render(
      <Harness
        initial={{
          id: "agenda-1",
          kind: "agenda",
          items: [{ title: "", time: "9:00", description: null }],
        }}
        errors={{ "items.0.title": "required" }}
      />,
    )
    const titleLabel = screen.getByText("block.agenda.item_title", { selector: "label" })
    const title = screen.getByLabelText("block.agenda.item_title")
    expect(titleLabel.getAttribute("for")).toBe(title.id)
    const timeLabel = screen.getByText("block.agenda.time", { selector: "label", exact: false })
    expect(timeLabel.getAttribute("for")).toBe(screen.getByDisplayValue("9:00").id)

    expect(screen.getAllByText("block.error.required")).toHaveLength(1)
    expect(within(titleLabel.parentElement!).getByText("block.error.required")).toBeTruthy()
    expect(within(timeLabel.parentElement!).queryByText("block.error.required")).toBeNull()
  })
})
