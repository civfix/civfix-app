import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import type * as ReactNative from "react-native"
import { COOKIES, legalApi, mountLegal, status } from "../../bodies/__tests__/legalUpdateHarness"
import { AppShell } from "../AppShell"

vi.mock("../../theme/useLayoutMode", () => ({ useLayoutMode: () => "compact" }))

vi.mock("../../typography", async () => {
  const RN = await vi.importActual<typeof ReactNative>("react-native")
  return { Text: RN.Text, Icon: () => null, iconMap: new Proxy({}, { get: () => "icon" }) }
})

vi.mock("react-native-safe-area-context", async () => {
  const { createContext } = await import("react")
  const insets = { top: 0, right: 0, bottom: 0, left: 0 }
  return { SafeAreaInsetsContext: createContext(insets), useSafeAreaInsets: () => insets }
})

// The app's bundle resolves the .native files: the shell's platform choices as the phone app makes them.
vi.mock("../detailPresentationPlatform", () => import("../detailPresentationPlatform.native"))
vi.mock("../mapRetentionPlatform", () => import("../mapRetentionPlatform.native"))
vi.mock("../searchRevealPlatform", () => import("../searchRevealPlatform.native"))

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

describe("AppShell's legal notice banner on the phone", () => {
  it("T18: on the compact layout it stays at the top of the screen", async () => {
    showShell()
    const { layer } = await bannerLayer()
    expect(getComputedStyle(layer).top).toBe("0px")
  })
})
