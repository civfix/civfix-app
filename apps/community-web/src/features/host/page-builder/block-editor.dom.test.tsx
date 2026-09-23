import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { EventPageBlock } from "@civfix/shared"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { BlockEditor } from "./block-editor"
import { replaceBlock, withRowKeys } from "./blocks"

function Harness({ initial }: { initial: EventPageBlock }) {
  const [blocks, setBlocks] = useState(() => withRowKeys([initial]))
  const block = blocks[0]!
  return (
    <BlockEditor
      block={block}
      onChange={(patch) => setBlocks((current) => replaceBlock(current, block.id, patch))}
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
