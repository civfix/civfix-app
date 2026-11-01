/**
 * The card clears the map's top-right controls, which move down by the fixed top bars: its expanded anchor
 * moves with them. The compact card hangs above the tab bar, so the bars never reach it.
 */
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type * as ReactNative from "react-native"
import type { LayoutMode } from "../../nav"
import { I18nProvider } from "../../i18n"
import { useSystemNoticeStore } from "../../shell/systemNoticeStore"
import { useTabBarStore } from "../../shell/tabBarStore"
import { useAppPromoStore } from "../appPromoStore"
import { PushPromptCard } from "../PushPromptCard"

const layout = vi.hoisted((): { mode: LayoutMode } => ({ mode: "expanded" }))

vi.mock("../../theme/useLayoutMode", () => ({ useLayoutMode: () => layout.mode }))
// The icon set pulls in native-only modules; only the card's anchor is under test.
vi.mock("../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return { Text, Icon: () => null, iconMap: {} }
})

const NOTICE_TEXT = "Scheduled maintenance tonight"

function resetStores() {
  useSystemNoticeStore.setState(useSystemNoticeStore.getInitialState())
  useAppPromoStore.setState(useAppPromoStore.getInitialState())
  useTabBarStore.setState(useTabBarStore.getInitialState())
}

function mount(mode: LayoutMode, bars: { notice: number; download: number; tabBar?: number }) {
  layout.mode = mode
  act(() => {
    useSystemNoticeStore.setState({ height: bars.notice })
    useAppPromoStore.setState({ bannerHeight: bars.download })
    useTabBarStore.setState({ tabBarHeight: bars.tabBar ?? 0 })
  })
  render(
    <I18nProvider locale="en" setLocale={() => undefined}>
      <PushPromptCard
        onTurnOn={() => undefined}
        onNotNow={() => undefined}
        onClose={() => undefined}
      />
    </I18nProvider>,
  )
}

function anchor(): HTMLElement {
  const parent = screen.getByRole("dialog").parentElement
  if (!parent) throw new Error("the card has no anchor")
  return parent
}

beforeEach(resetStores)

afterEach(() => {
  cleanup()
  resetStores()
})

describe("PushPromptCard's anchor under the fixed top bars", () => {
  it("T31: expanded with no bars, it sits at top 76 and right 12", () => {
    mount("expanded", { notice: 0, download: 0 })
    expect(getComputedStyle(anchor()).top).toBe("76px")
    expect(getComputedStyle(anchor()).right).toBe("12px")
  })

  it("T32: expanded with a 36 px notice, it sits at top 112", () => {
    mount("expanded", { notice: 36, download: 0 })
    expect(getComputedStyle(anchor()).top).toBe("112px")
  })

  it("T33: expanded with a 36 px notice and a 20 px banner, it sits at top 132", () => {
    mount("expanded", { notice: 36, download: 20 })
    expect(getComputedStyle(anchor()).top).toBe("132px")
  })

  it("T34: dismissing the notice moves it from top 112 to 76 without a remount", () => {
    mount("expanded", { notice: 36, download: 0 })
    const mounted = anchor()
    expect(getComputedStyle(mounted).top).toBe("112px")
    act(() => {
      useSystemNoticeStore.getState().dismiss(NOTICE_TEXT)
    })
    expect(anchor()).toBe(mounted)
    expect(getComputedStyle(mounted).top).toBe("76px")
  })

  it("T35: compact with a 56 px tab bar and a 36 px notice, it hangs at bottom 68 with no top", () => {
    mount("compact", { notice: 36, download: 0, tabBar: 56 })
    expect(getComputedStyle(anchor()).bottom).toBe("68px")
    expect(getComputedStyle(anchor()).top).toBe("auto")
  })
})
