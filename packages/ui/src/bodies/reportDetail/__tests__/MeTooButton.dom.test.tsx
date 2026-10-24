import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type * as ReactNative from "react-native"
import { ThemeProvider, themes, type ColorSchemeName } from "../../../theme"
import { MeTooButton, type MeTooTone } from "../MeTooButton"

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

// jsdom reports computed colours as rgb(); the theme holds hex.
function rgb(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

function shading(el: HTMLElement) {
  const cs = getComputedStyle(el)
  return { fill: cs.backgroundColor, border: cs.borderTopColor }
}

describe.each<ColorSchemeName>(["light", "dark"])("MeTooButton shading (%s)", (scheme) => {
  const c = themes[scheme].colors
  const toned = {
    seen: { solid: c.brand.bloom, ramp: c.bloom, ink: c.chipInk.bloom },
    fixed: { solid: c.brand.moss, ramp: c.moss, ink: c.chipInk.moss },
  }

  function renderVote(tone: MeTooTone, { pressed = false, size = "md" }: { pressed?: boolean; size?: "sm" | "md" }) {
    render(
      <ThemeProvider preference={scheme}>
        <MeTooButton tone={tone} size={size} label="Vote" accessibilityLabel="Vote" pressed={pressed} onPress={() => {}} />
      </ThemeProvider>,
    )
    return screen.getByRole("button")
  }

  it.each<MeTooTone>(["seen", "fixed"])("%s, not voted: the surface fill with the tone's 300 border", (tone) => {
    expect(shading(renderVote(tone, {}))).toEqual({ fill: rgb(c.surface), border: rgb(toned[tone].ramp["300"]) })
  })

  it.each<MeTooTone>(["seen", "fixed"])("%s, voted: the tone's 50 wash with its solid border", (tone) => {
    expect(shading(renderVote(tone, { pressed: true }))).toEqual({
      fill: rgb(toned[tone].ramp["50"]),
      border: rgb(toned[tone].solid),
    })
  })

  it.each<MeTooTone>(["seen", "fixed"])("%s, small: the tone's 50 wash with its 300 border", (tone) => {
    expect(shading(renderVote(tone, { size: "sm" }))).toEqual({
      fill: rgb(toned[tone].ramp["50"]),
      border: rgb(toned[tone].ramp["300"]),
    })
  })

  it.each([
    { state: "not voted", pressed: false, size: "md" as const, hover: "50" as const },
    { state: "voted", pressed: true, size: "md" as const, hover: "100" as const },
    { state: "small", pressed: false, size: "sm" as const, hover: "100" as const },
  ])("on hover, $state takes the tone's $hover", ({ pressed, size, hover }) => {
    const el = renderVote("seen", { pressed, size })
    // react-native-web tracks hover from pointerenter, and ignores touch pointers.
    fireEvent.pointerEnter(el, { pointerType: "mouse" })
    expect(shading(el).fill).toBe(rgb(toned.seen.ramp[hover]))
  })
})
