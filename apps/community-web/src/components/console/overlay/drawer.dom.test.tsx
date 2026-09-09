import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "../__testing__/harness"
import { Drawer } from "./drawer"

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <button type="button">outside before</button>
      <Drawer
        open={open}
        onClose={() => {
          onClose?.()
          setOpen(false)
        }}
        title="Attendee"
        footer={<button type="button">Save</button>}
      >
        <button type="button">first</button>
        <button type="button">second</button>
      </Drawer>
      <button type="button">outside after</button>
    </>
  )
}

describe("Drawer", () => {
  it("is a modal dialog that assistive tech can NAME", () => {
    renderConsole(<Harness />)
    const dialog = screen.getByRole("dialog", { name: "Attendee" })
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    const labelledBy = dialog.getAttribute("aria-labelledby")
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy as string)?.textContent).toBe("Attendee")
  })

  it("moves focus into the panel on open", () => {
    renderConsole(<Harness />)
    const dialog = screen.getByRole("dialog")
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it("wraps Tab from the last control back to the first", async () => {
    const user = userEvent.setup()
    renderConsole(<Harness />)
    const save = screen.getByRole("button", { name: "Save" })
    save.focus()
    await user.tab()
    const dialog = screen.getByRole("dialog")
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "outside after" }))
  })

  it("wraps Shift+Tab from the first control to the last", async () => {
    const user = userEvent.setup()
    renderConsole(<Harness />)
    const dialog = screen.getByRole("dialog")
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>("button"))
    focusables[0]?.focus()
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(focusables[focusables.length - 1])
  })

  it("closes on Escape and restores focus to the opener", async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderConsole(<Harness onClose={onClose} />)
    await user.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("closes when the scrim is clicked", async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderConsole(<Harness onClose={onClose} />)
    const scrim = document.querySelector("button[aria-hidden]")
    expect(scrim).not.toBeNull()
    await user.click(scrim as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("renders nothing at all when closed", () => {
    renderConsole(
      <Drawer open={false} onClose={() => {}} title="Attendee">
        <button type="button">first</button>
      </Drawer>,
    )
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByRole("button", { name: "first" })).toBeNull()
  })
})
