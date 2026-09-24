import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "../__testing__/harness"
import { closeConsoleDrawer, setConsoleParams, useConsoleUrlState } from "../url-state"
import { Drawer } from "./drawer"

afterEach(cleanup)

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

function ParamDrawerHarness() {
  const { params } = useConsoleUrlState()
  return (
    <Drawer
      open={params.attendee !== undefined}
      onClose={() => closeConsoleDrawer(["attendee"])}
      title="Attendee"
    >
      <button type="button">detail</button>
    </Drawer>
  )
}

describe("a drawer addressed by a pushed URL param", () => {
  it("closes by traversing the entry it pushed, so browser Back does not re-open it", async () => {
    window.history.replaceState(null, "", "/manage/events/e1/attendees/")
    renderConsole(<ParamDrawerHarness />)
    expect(screen.queryByRole("dialog")).toBeNull()

    await act(async () => {
      setConsoleParams({ attendee: "a1" }, "push")
    })
    expect(screen.getByRole("dialog", { name: "Attendee" })).not.toBeNull()
    expect(window.location.search).toBe("?attendee=a1")
    const lengthWithDrawer = window.history.length

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "action.close" }))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(window.location.search).toBe("")
    expect(window.history.length).toBe(lengthWithDrawer)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("keeps a filter changed while the drawer was open instead of reverting it on close", async () => {
    window.history.replaceState(null, "", "/manage/events/e1/attendees/?ticket=t1")
    renderConsole(<ParamDrawerHarness />)

    await act(async () => {
      setConsoleParams({ attendee: "a1" }, "push")
    })
    await act(async () => {
      setConsoleParams({ q: "ann", cursor: null })
    })
    expect(window.location.search).toBe("?q=ann&ticket=t1&attendee=a1")
    const lengthWithDrawer = window.history.length

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "action.close" }))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(window.location.search).toBe("?q=ann&ticket=t1")
    expect(window.history.length).toBe(lengthWithDrawer)
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})

function WideDrawerHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open attendee
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Attendee">
        <button type="button">detail</button>
      </Drawer>
    </>
  )
}

describe("a non-modal drawer on a wide screen", () => {
  const original = window.matchMedia

  afterEach(() => {
    window.matchMedia = original
  })

  it("moves focus into the panel on open and returns it to the opener on close", async () => {
    window.matchMedia = ((query: string) => ({
      matches: query === "(min-width: 1440px)",
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
    const user = userEvent.setup()
    renderConsole(<WideDrawerHarness />)
    const opener = screen.getByRole("button", { name: "open attendee" })
    await user.click(opener)

    const dialog = screen.getByRole("dialog", { name: "Attendee" })
    expect(dialog.getAttribute("aria-modal")).toBeNull()
    expect(dialog.contains(document.activeElement)).toBe(true)

    await user.click(screen.getByRole("button", { name: "action.close" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(opener)
  })
})
