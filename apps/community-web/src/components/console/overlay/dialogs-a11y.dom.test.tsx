import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "../__testing__/harness"
import { ConfirmModal } from "./confirm-modal"
import { GuidedSheet } from "./guided-sheet"
import { Overlay } from "./overlay"

afterEach(cleanup)

function describedText(el: HTMLElement): string {
  return (el.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ")
}

describe("ConfirmModal", () => {
  it("is labelled by its heading and described by its banner and body", () => {
    renderConsole(
      <ConfirmModal
        open
        severity="danger"
        title="Remove 3 attendees?"
        banner="This cannot be undone."
        body="They will be emailed."
        confirmLabel="Remove"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )
    const dialog = screen.getByRole("alertdialog", { name: "Remove 3 attendees?" })
    const heading = screen.getByRole("heading", { name: "Remove 3 attendees?" })
    expect(dialog.getAttribute("aria-labelledby")).toBe(heading.id)
    expect(dialog.hasAttribute("aria-label")).toBe(false)
    expect(describedText(dialog)).toBe("This cannot be undone. They will be emailed.")
  })

  it("carries no description when there is no banner or body", () => {
    renderConsole(
      <ConfirmModal open title="Sure?" confirmLabel="Yes" onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(screen.getByRole("alertdialog", { name: "Sure?" }).hasAttribute("aria-describedby")).toBe(
      false,
    )
  })
})

describe("GuidedSheet", () => {
  it("is labelled by its heading rather than a repeated aria-label", () => {
    renderConsole(
      <GuidedSheet open onClose={() => {}} title="Publish event" primaryLabel="Publish" onPrimary={() => {}} />,
    )
    const dialog = screen.getByRole("dialog", { name: "Publish event" })
    expect(dialog.hasAttribute("aria-label")).toBe(false)
    expect(document.getElementById(dialog.getAttribute("aria-labelledby") ?? "")?.tagName).toBe("H3")
  })
})

function PopoverHarness() {
  const [open, setOpen] = useState(false)
  return (
    <Overlay
      open={open}
      onClose={() => setOpen(false)}
      label="Status"
      id="status-panel"
      trigger={
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          Status
        </button>
      }
    >
      <label>
        <input type="checkbox" /> Going
      </label>
    </Overlay>
  )
}

describe("Overlay on a desktop viewport", () => {
  it("moves focus into the popover and returns it to the trigger on Escape", async () => {
    const user = userEvent.setup()
    renderConsole(<PopoverHarness />)
    const trigger = screen.getByRole("button", { name: "Status" })
    await user.click(trigger)

    const panel = screen.getByRole("dialog", { name: "Status" })
    expect(panel.id).toBe("status-panel")
    expect(panel.contains(document.activeElement)).toBe(true)

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})
