import { readFileSync } from "node:fs"
import { join } from "node:path"
import * as React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import type * as ReactNative from "react-native"
import type { LayoutMode } from "../../nav"
import { COOKIES, legalApi, mountLegal, status } from "../../bodies/__tests__/legalUpdateHarness"
import { AppShell } from "../AppShell"
import { NAV_FOOTPRINT } from "../expandedFramePlan"

const layout = vi.hoisted(() => ({ mode: "expanded" as LayoutMode }))

vi.mock("../../theme/useLayoutMode", () => ({ useLayoutMode: () => layout.mode }))

vi.mock("../../typography", async () => {
  const RN = await vi.importActual<typeof ReactNative>("react-native")
  return { Text: RN.Text, Icon: () => null, iconMap: new Proxy({}, { get: () => "icon" }) }
})

vi.mock("react-native-safe-area-context", async () => {
  const { createContext } = await import("react")
  const insets = { top: 0, right: 0, bottom: 0, left: 0 }
  return { SafeAreaInsetsContext: createContext(insets), useSafeAreaInsets: () => insets }
})

// The shells' own import graphs don't load in jsdom; the banner is AppShell's sibling of them.
vi.mock("../ExpandedShell", () => ({ ExpandedShell: () => null }))
vi.mock("../PortraitShell", () => ({ PortraitShell: () => null }))
vi.mock("../BodyRouter", () => ({ defaultRenderBody: () => null }))
vi.mock("../../lightbox", () => ({
  MediaLightboxProvider: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock("../../share/SharePostProvider", () => ({
  SharePostProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const NOTICE = "We've updated our Cookies notice. Adds two providers"

/** The layers the expanded shell draws over the window: the panel card, its resize handle and the nav rail. */
function expandedShellZIndexes(): number[] {
  return ["ExpandedShell.tsx", "Rail.tsx"].flatMap((file) =>
    [...readFileSync(join(__dirname, "..", file), "utf8").matchAll(/zIndex: (\d+)/g)].map((match) =>
      Number(match[1]),
    ),
  )
}

async function bannerLayer(): Promise<{ layer: HTMLElement; card: HTMLElement }> {
  const text = await screen.findByText(NOTICE)
  let card: HTMLElement | null = text.parentElement
  while (card !== null && getComputedStyle(card).maxWidth !== "560px") card = card.parentElement
  let layer: HTMLElement | null = card
  while (layer !== null && getComputedStyle(layer).position !== "absolute") layer = layer.parentElement
  if (card === null || layer === null) throw new Error("no banner layer")
  return { layer, card }
}

function showShell() {
  const legal = legalApi(status({ required: [], notices: [COOKIES] }))
  return mountLegal(<AppShell map={null} mapControls={null} />, { api: legal.api })
}

beforeEach(() => {
  layout.mode = "expanded"
})

describe("AppShell's legal notice banner", () => {
  it("T17: on the wide layout it sits below the top bar row, above every expanded-shell layer, 560 wide at most", async () => {
    layout.mode = "expanded"
    showShell()
    const { layer, card } = await bannerLayer()
    expect(getComputedStyle(layer).top).toBe(`${NAV_FOOTPRINT}px`)
    const zIndex = Number(getComputedStyle(layer).zIndex)
    const shellLayers = expandedShellZIndexes()
    expect(shellLayers.length).toBeGreaterThan(0)
    for (const shellLayer of shellLayers) expect(zIndex).toBeGreaterThan(shellLayer)
    expect(getComputedStyle(card).maxWidth).toBe("560px")
  })

  it("T18: on the compact layout it stays at the top of the screen", async () => {
    layout.mode = "compact"
    showShell()
    const { layer } = await bannerLayer()
    expect(getComputedStyle(layer).top).toBe("0px")
  })
})
