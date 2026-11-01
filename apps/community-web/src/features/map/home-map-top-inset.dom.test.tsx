/**
 * A long press flies the camera so the dropped pin clears what covers the top of the map. On web that is
 * the fixed top bars: the system notice and the app download banner under it.
 */
import * as React from "react"
import { act, render, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

interface MapProps {
  onLongPressMap: (lat: number, lng: number) => void
}

const captured = vi.hoisted(() => ({ map: null as MapProps | null }))
const dropPinCameraTarget = vi.hoisted(() =>
  vi.fn((input: { lat: number; lng: number }) => ({ ...input, zoom: 16 })),
)

vi.mock("@civfix/ui", async () => {
  const [{ forwardRef }, bars, notice, promo] = await Promise.all([
    import("react"),
    import("../../../../../packages/ui/src/shell/topBars"),
    import("../../../../../packages/ui/src/shell/systemNoticeStore"),
    import("../../../../../packages/ui/src/promo/appPromoStore"),
  ])
  const filters = {
    enabled: new Set<string>(),
    eventsEnabled: false,
    setCounts: () => {},
    setLayersOpen: () => {},
  }
  const nav = { stack: [], view: "map", snap: "mid", mode: "compact" }
  return {
    ...bars,
    useSystemNoticeStore: notice.useSystemNoticeStore,
    useAppPromoStore: promo.useAppPromoStore,
    Map: forwardRef<unknown, MapProps>((props, _ref) => {
      captured.map = props
      return null
    }),
    MapPending: () => null,
    space: { "8": 32 },
    useNavStore: Object.assign(() => nav, { getState: () => nav }),
    useReportFilterStore: Object.assign(
      (select: (state: typeof filters) => unknown) => select(filters),
      { getState: () => filters },
    ),
    useMapViewport: { getState: () => ({ viewport: null }) },
    useMapFocus: { getState: () => ({ focus: null }) },
    useMapFlyTo: { getState: () => ({ highlight: null }) },
    useLayoutMode: () => "compact",
    enabledCategoriesArray: () => [],
    shellOcclusionLeft: () => 0,
    openDropPinMenu: () => true,
    dropPinCameraTarget,
    captureDropPinCamera: () => {},
    setDropPinCameraRestorer: () => {},
    decideRegionFetch: () => ({ action: "keep" }),
    resolveMapCenter: () => ({
      center: { lat: 34.05, lng: -118.25, zoom: 12 },
      source: "remembered",
    }),
    shouldAdoptCenter: () => false,
    holdsRememberedCamera: () => true,
    PRECISE_ZOOM: 16,
    APPROX_ZOOM: 12,
  }
})
vi.mock("@civfix/ui/data", () => ({
  useApproximateLocation: () => ({ data: undefined }),
  useCleanups: () => ({ data: [] }),
  useMapReports: () => ({
    data: undefined,
    isError: false,
    isSuccess: false,
    isPlaceholderData: false,
  }),
}))
vi.mock("@/features/map/camera-snapshot", () => ({
  readCameraSnapshot: () => null,
  writeCameraSnapshot: () => {},
}))
vi.mock("@/lib/locate", () => ({
  resolvePreciseCenterAfterPrompt: async () => ({ precise: null, prompted: false }),
  getBrowserPosition: async () => null,
}))

const { useSystemNoticeStore } =
  await import("../../../../../packages/ui/src/shell/systemNoticeStore")
const { useAppPromoStore } = await import("../../../../../packages/ui/src/promo/appPromoStore")
const { HomeMap } = await import("./home-map")

describe("HomeMap long press under the top bars", () => {
  it("T21: the drop-pin camera keeps the pin clear of a 36px notice over a 64px download banner", async () => {
    useSystemNoticeStore.setState({ height: 36 })
    useAppPromoStore.setState({ bannerHeight: 64 })
    render(<HomeMap />)
    await waitFor(() => expect(captured.map).not.toBeNull())
    act(() => captured.map!.onLongPressMap(34.06, -118.24))
    expect(dropPinCameraTarget).toHaveBeenCalledTimes(1)
    expect(dropPinCameraTarget).toHaveBeenCalledWith(expect.objectContaining({ topInset: 100 }))
  })
})
