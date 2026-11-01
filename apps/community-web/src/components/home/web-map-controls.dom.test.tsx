/**
 * The floating map controls sit below every fixed top bar: the system notice and, in portrait, the app
 * download banner under it. In the wide layout the download banner never shows, so only the notice counts.
 */
import * as React from "react"
import { act, render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const topInsets = vi.hoisted(() => [] as number[])

vi.mock("@civfix/ui", async () => {
  const [bars, notice, promo] = await Promise.all([
    import("../../../../../packages/ui/src/shell/topBars"),
    import("../../../../../packages/ui/src/shell/systemNoticeStore"),
    import("../../../../../packages/ui/src/promo/appPromoStore"),
  ])
  return {
    ...bars,
    useSystemNoticeStore: notice.useSystemNoticeStore,
    useAppPromoStore: promo.useAppPromoStore,
    MapControls: ({ topInset }: { topInset: number }) => {
      topInsets.push(topInset)
      return null
    },
  }
})
vi.mock("@civfix/ui/data", () => ({ useTotalUnread: () => 0 }))

const { useSystemNoticeStore } =
  await import("../../../../../packages/ui/src/shell/systemNoticeStore")
const { useAppPromoStore } = await import("../../../../../packages/ui/src/promo/appPromoStore")
const { WebMapControls } = await import("./web-map-controls")

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

describe("WebMapControls under the top bars", () => {
  it("T20: the controls clear both bars, and return to the design offset once both are gone", () => {
    render(<WebMapControls />)
    const designOffset = topInsets.at(-1)!

    heights(36, 64)
    expect(topInsets.at(-1)).toBe(designOffset + 100)

    heights(0, 0)
    expect(topInsets.at(-1)).toBe(designOffset)
  })

  it("T22: in the wide layout (no download banner) the map-controls row sits exactly 36px lower under a 36px notice", () => {
    render(<WebMapControls />)
    const designOffset = topInsets.at(-1)!
    heights(36, 0)
    expect(topInsets.at(-1)).toBe(designOffset + 36)
  })
})
