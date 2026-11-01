import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"
import { View } from "react-native"
import type { LayoutMode, View as NavView } from "../../nav"
import { useNavStore } from "../../nav"
import { AppShell } from "../AppShell"

const layout = vi.hoisted((): { mode: LayoutMode } => ({ mode: "expanded" }))

vi.mock("../../theme/useLayoutMode", () => ({ useLayoutMode: () => layout.mode }))

vi.mock("react-native-safe-area-context", async () => {
  const { createContext } = await import("react")
  const insets = { top: 0, right: 0, bottom: 0, left: 0 }
  return { SafeAreaInsetsContext: createContext(insets), useSafeAreaInsets: () => insets }
})

// The shells' own import graphs don't load in jsdom; the layers under test are AppShell's own.
vi.mock("../ExpandedShell", () => ({ ExpandedShell: () => null }))
vi.mock("../PortraitShell", () => ({ PortraitShell: () => null }))
vi.mock("../BodyRouter", () => ({ defaultRenderBody: () => null }))
vi.mock("../../lightbox", () => ({
  MediaLightboxProvider: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock("../../share/SharePostProvider", () => ({
  SharePostProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const CONTROLS_Z = "50"
const OVERLAY_Z = "70"

function mountShell(mode: LayoutMode, view: NavView, withPrompt: boolean) {
  layout.mode = mode
  act(() => {
    useNavStore.getState().reset()
    useNavStore.getState().selectView(view)
  })
  return render(
    <AppShell
      map={null}
      mapControls={<View testID="control-row" />}
      authOverlay={<View testID="auth-overlay" />}
      {...(withPrompt ? { mapPrompt: <View testID="push-card" /> } : {})}
    />,
  )
}

/** The shell's own absolute layer of that zIndex, or null when it isn't mounted. */
function layer(container: HTMLElement, zIndex: string): HTMLElement | null {
  return (
    Array.from(container.querySelectorAll<HTMLElement>("div")).find(
      (el) => getComputedStyle(el).zIndex === zIndex,
    ) ?? null
  )
}

function childTestIds(el: HTMLElement | null): (string | null)[] {
  return el ? Array.from(el.children).map((child) => child.getAttribute("data-testid")) : []
}

afterEach(() => {
  act(() => {
    useNavStore.getState().reset()
  })
})

describe("AppShell's map prompt slot", () => {
  it("T27: on the expanded layout the card draws in the map-controls layer, before the controls, and not in the overlay", () => {
    const { container } = mountShell("expanded", "home", true)
    const controls = layer(container, CONTROLS_Z)
    const overlay = layer(container, OVERLAY_Z)
    const card = screen.getByTestId("push-card")

    expect(controls).not.toBeNull()
    expect(controls?.contains(card)).toBe(true)
    expect(
      card.compareDocumentPosition(screen.getByTestId("control-row")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(overlay?.contains(card) ?? false).toBe(false)
    expect(overlay?.querySelector('[data-testid="push-card"]') ?? null).toBeNull()
  })

  // The compact "inbox" is the messaging view: its body is the thread inbox (`bodies/inbox`).
  for (const view of ["map", "messaging"] as const) {
    it(`T28: on the compact layout, view "${view}", the card draws in the overlay and not in the map-controls layer`, () => {
      const { container } = mountShell("compact", view, true)
      const controls = layer(container, CONTROLS_Z)
      const overlay = layer(container, OVERLAY_Z)
      const card = screen.getByTestId("push-card")

      if (view === "map") expect(controls).not.toBeNull()
      expect(overlay).not.toBeNull()
      expect(overlay?.contains(card)).toBe(true)
      expect(controls?.contains(card) ?? false).toBe(false)
    })
  }

  for (const [mode, view] of [
    ["expanded", "home"],
    ["compact", "map"],
    ["compact", "messaging"],
  ] as const) {
    it(`T29: with no prompt passed (${mode}, view "${view}") neither layer gains an element`, () => {
      const { container } = mountShell(mode, view, false)

      expect(screen.queryByTestId("push-card")).toBeNull()
      expect(childTestIds(layer(container, CONTROLS_Z))).toEqual(
        mode === "compact" && view === "messaging" ? [] : ["control-row"],
      )
      expect(childTestIds(layer(container, OVERLAY_Z))).toEqual(["auth-overlay"])
    })
  }

  it("T29: with neither an overlay nor a prompt passed there is no overlay layer", () => {
    layout.mode = "expanded"
    const { container } = render(<AppShell map={null} mapControls={null} />)

    expect(layer(container, OVERLAY_Z)).toBeNull()
  })
})
