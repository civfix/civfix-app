import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "../../__testing__/harness"
import { RichTextEditor } from "./editor"

function Harness({
  initial = "",
  promptForLink,
}: {
  initial?: string
  promptForLink?: (current: string) => string | null
}) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <RichTextEditor
        id="body"
        value={value}
        onChange={setValue}
        {...(promptForLink ? { promptForLink } : {})}
      />
      <output data-testid="value">{value}</output>
    </>
  )
}

function editor(): HTMLTextAreaElement {
  return document.getElementById("body") as HTMLTextAreaElement
}

function currentValue(): string {
  return screen.getByTestId("value").textContent ?? ""
}

describe("RichTextEditor", () => {
  it("bolds the selection with the keyboard shortcut", async () => {
    const user = userEvent.setup()
    renderConsole(<Harness initial="hello world" />)
    const area = editor()
    area.focus()
    area.setSelectionRange(0, 5)
    await user.keyboard("{Meta>}b{/Meta}")
    expect(currentValue()).toBe("**hello** world")
  })

  it("unbolds a selection that is already bold", async () => {
    const user = userEvent.setup()
    renderConsole(<Harness initial="**hello** world" />)
    const area = editor()
    area.focus()
    area.setSelectionRange(0, 9)
    await user.keyboard("{Meta>}b{/Meta}")
    expect(currentValue()).toBe("hello world")
  })

  it("italicises with the toolbar button", async () => {
    const user = userEvent.setup()
    renderConsole(<Harness initial="hi" />)
    const area = editor()
    area.focus()
    area.setSelectionRange(0, 2)
    await user.click(screen.getByRole("button", { name: /editor\.italic/ }))
    expect(currentValue()).toBe("_hi_")
  })

  it("inserts an https link and keeps the label selected", async () => {
    const user = userEvent.setup()
    renderConsole(
      <Harness initial="civfix" promptForLink={() => "https://civfix.org"} />,
    )
    const area = editor()
    area.focus()
    area.setSelectionRange(0, 6)
    await user.keyboard("{Meta>}k{/Meta}")
    expect(currentValue()).toBe("[civfix](https://civfix.org)")
  })

  it("REFUSES a javascript: url and says so instead of writing it into the source", async () => {
    const user = userEvent.setup()
    renderConsole(
      <Harness initial="civfix" promptForLink={() => "javascript:alert(1)"} />,
      { withToasts: false },
    )
    const area = editor()
    area.focus()
    area.setSelectionRange(0, 6)
    await user.keyboard("{Meta>}k{/Meta}")
    expect(currentValue()).toBe("civfix")
    expect(screen.getByRole("alert").textContent).toContain("editor.link_invalid")
  })

  it("does nothing when the link prompt is dismissed", async () => {
    const user = userEvent.setup()
    renderConsole(<Harness initial="civfix" promptForLink={() => null} />, {
      withToasts: false,
    })
    const area = editor()
    area.focus()
    area.setSelectionRange(0, 6)
    await user.keyboard("{Meta>}k{/Meta}")
    expect(currentValue()).toBe("civfix")
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("renders the preview as real elements, never as markup", async () => {
    const user = userEvent.setup()
    renderConsole(<Harness />, { withToasts: false })
    const area = editor()
    await user.click(area)
    await user.paste("**bold** and [x](https://civfix.org)")
    expect(document.querySelector("strong")?.textContent).toBe("bold")
    const link = document.querySelector("a[href='https://civfix.org']")
    expect(link).not.toBeNull()
    expect(link?.getAttribute("rel")).toContain("noopener")
  })

  it("never lets an unsafe href reach the preview even if it is typed by hand", async () => {
    const user = userEvent.setup()
    renderConsole(<Harness />, { withToasts: false })
    const area = editor()
    await user.click(area)
    await user.paste("[x](javascript:alert(1))")
    expect(document.querySelector("a[href^='javascript']")).toBeNull()
  })

  it("does not inject markup from an angle-bracket payload", async () => {
    const user = userEvent.setup()
    renderConsole(<Harness />, { withToasts: false })
    const area = editor()
    await user.click(area)
    await user.paste("<img src=x onerror=1>")
    expect(document.querySelector("img")).toBeNull()
  })
})
