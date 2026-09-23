import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "../__testing__/harness"
import { ErrorSummary } from "./error-summary"
import { Field } from "./field"
import { SegmentedControl } from "./segmented-control"
import { ToggleRow } from "./toggle-row"

const originalMatchMedia = window.matchMedia

afterEach(() => {
  cleanup()
  window.matchMedia = originalMatchMedia
})

function descriptionOf(el: HTMLElement): string {
  return (el.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ")
}

describe("SegmentedControl", () => {
  it("keeps a disabled option focusable and describes why it is disabled", () => {
    const onChange = vi.fn()
    renderConsole(
      <SegmentedControl
        label="Kind"
        value="email"
        onChange={onChange}
        options={[
          { value: "email", label: "Email" },
          { value: "sms", label: "SMS", disabled: true, disabledReason: "SMS is not enabled" },
        ]}
      />,
    )
    const sms = screen.getByRole("button", { name: "SMS" })
    expect(sms.hasAttribute("disabled")).toBe(false)
    expect(sms.getAttribute("aria-disabled")).toBe("true")
    expect(descriptionOf(sms)).toBe("SMS is not enabled")
    fireEvent.click(sms)
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe("Field", () => {
  it("names a group by its label when the child is not a labelable control", () => {
    renderConsole(
      <Field label="Invite by" hint="Pick one">
        <button type="button">Email</button>
      </Field>,
    )
    const group = screen.getByRole("group", { name: "Invite by" })
    expect(descriptionOf(group)).toBe("Pick one")
    expect(document.querySelector("label")).toBeNull()
  })

  it("keeps a real label for a control addressed by htmlFor", () => {
    renderConsole(
      <Field label="Name" htmlFor="name">
        <input id="name" />
      </Field>,
    )
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy()
    expect(screen.queryByRole("group")).toBeNull()
  })

  it("lets a form with an error summary stop each field error from alerting again", () => {
    renderConsole(
      <Field label="Name" htmlFor="name" error="Required" announceError={false}>
        <input id="name" />
      </Field>,
      { withToasts: false },
    )
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByText("Required")).toBeTruthy()
  })

  it("still alerts a field error by default", () => {
    renderConsole(
      <Field label="Name" htmlFor="name" error="Required">
        <input id="name" />
      </Field>,
      { withToasts: false },
    )
    expect(screen.getByRole("alert").textContent).toBe("Required")
  })
})

describe("ErrorSummary", () => {
  it("jumps to the field without smooth scrolling when reduced motion is requested", () => {
    window.matchMedia = ((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
    renderConsole(
      <>
        <input id="title" />
        <ErrorSummary errors={[{ id: "title", message: "Add a title" }]} />
      </>,
    )
    const field = document.getElementById("title") as HTMLInputElement
    const scroll = vi.fn()
    field.scrollIntoView = scroll
    fireEvent.click(screen.getByRole("button", { name: "Add a title" }))
    expect(scroll).toHaveBeenCalledWith({ block: "center", behavior: "auto" })
  })
})

describe("ToggleRow", () => {
  it("describes the switch with its caption and lock reason, and reads the reason once", () => {
    renderConsole(
      <ToggleRow
        label="Waitlist"
        caption="Let people queue"
        checked={false}
        onChange={() => {}}
        locked
        lockedReason="Set by your organization"
      />,
    )
    const toggle = screen.getByRole("switch", { name: "Waitlist" })
    expect(descriptionOf(toggle)).toBe("Let people queue Set by your organization")
    expect(screen.getAllByText("Set by your organization")).toHaveLength(1)
  })
})
