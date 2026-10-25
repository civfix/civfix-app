/**
 * The web portrait shell sits its sheet and search header below the fixed top bars: the system notice and,
 * under it, the app download banner. Both already pad for the notch, so the safe-area top counts only when
 * it is the larger of the two.
 */
import * as React from "react"
import { act, render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { EdgeInsets } from "react-native-safe-area-context"
import type { PortraitShellProps } from "../PortraitShell.shared"

const topInsets = vi.hoisted(() => [] as number[])

vi.mock("../PortraitShell.shared", () => ({
  PortraitShellFrame: ({ topInset }: { topInset: number }) => {
    topInsets.push(topInset)
    return null
  },
}))
vi.mock("../tabBarLogic", () => ({ initialTabBarFootprint: () => 0 }))
vi.mock("../useKeyboardInset.web", () => ({ useKeyboardInset: () => 0 }))
// The package's CommonJS build requires the Flow-typed react-native, outside this project's alias to
// react-native-web; the shell only reads the context.
vi.mock("react-native-safe-area-context", async () => {
  const { createContext } = await vi.importActual<typeof React>("react")
  return { SafeAreaInsetsContext: createContext<EdgeInsets | null>(null) }
})

const { SafeAreaInsetsContext } = await import("react-native-safe-area-context")
const { PortraitShell } = await import("../PortraitShell.web")
const { useAppPromoStore } = await import("../../promo/appPromoStore")
const { useSystemNoticeStore } = await import("../systemNoticeStore")

function insets(top: number): EdgeInsets {
  return { top, right: 0, bottom: 0, left: 0 }
}

function shell(top: number) {
  return (
    <SafeAreaInsetsContext.Provider value={insets(top)}>
      <PortraitShell {...({} as PortraitShellProps)} />
    </SafeAreaInsetsContext.Provider>
  )
}

function heights(notice: number, download: number) {
  act(() => {
    useSystemNoticeStore.setState({ height: notice })
    useAppPromoStore.setState({ bannerHeight: download })
  })
}

beforeEach(() => {
  topInsets.length = 0
  useSystemNoticeStore.setState({ dismissedHash: null, height: 0 })
  useAppPromoStore.setState({ dismissed: false, bannerHeight: 0, cardHeight: 0 })
})

describe("PortraitShell (web): the top inset under the fixed bars", () => {
  it("T19: max(insets.top, notice + download) as the bars come and go", () => {
    heights(36, 64)
    const { rerender } = render(shell(0))
    expect(topInsets.at(-1)).toBe(100)

    heights(36, 0)
    expect(topInsets.at(-1)).toBe(36)

    heights(0, 0)
    rerender(shell(20))
    expect(topInsets.at(-1)).toBe(20)
  })
})
