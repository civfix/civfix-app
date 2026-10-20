import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type * as ReactNative from "react-native"
import { MeTooButton } from "../MeTooButton"

// The icon set pulls in native-only modules; the button is read by its role and attributes.
vi.mock("../../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return { Text, Icon: () => null, iconMap: {} }
})

function button({ pressed = false, busy = false }: { pressed?: boolean; busy?: boolean }) {
  return (
    <MeTooButton
      label="I see this too"
      accessibilityLabel="I see this problem too"
      pressed={pressed}
      busy={busy}
      onPress={() => {}}
    />
  )
}

describe("MeTooButton on web", () => {
  it("T20: tells a screen reader whether it is pressed", () => {
    const { rerender } = render(button({ pressed: true }))
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true")
    rerender(button({ pressed: false }))
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false")
  })

  it("T21: tells a screen reader while it is busy", () => {
    const { rerender } = render(button({ busy: true }))
    expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("true")
    rerender(button({ busy: false }))
    expect(screen.getByRole("button").getAttribute("aria-busy")).not.toBe("true")
  })

  it("grows the md button to fill its half of the row, so a pair stays one height when one label wraps", () => {
    const { unmount } = render(button({}))
    expect(getComputedStyle(screen.getByRole("button")).flexGrow).toBe("1")
    unmount()
    render(<MeTooButton size="sm" label="I see this too" accessibilityLabel="I see this problem too" pressed={false} onPress={() => {}} />)
    expect(getComputedStyle(screen.getByRole("button")).flexGrow).not.toBe("1")
  })
})
