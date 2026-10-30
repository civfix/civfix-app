import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import { usePickerData } from "../usePickerData"
import { PICKER_CATEGORIES, useReportPickerFilters } from "../reportPickerFilterStore"

const idle = {
  data: undefined,
  isError: false,
  isPending: false,
  isLoading: false,
  error: null,
  refetch: () => {},
}

vi.mock("../../../data", () => ({
  useMapReports: () => idle,
  useReport: () => idle,
  useReportSearch: () => ({
    ...idle,
    items: [],
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: () => {},
  }),
}))

vi.mock("../../../i18n", () => ({ useT: () => ({ t: (key: string) => key }) }))

const center = { lat: 40, lng: -74 }
const none = new Set<string>()

function Picker() {
  usePickerData({ center, linked: [], query: "", idSet: none, linkedSet: none })
  return null
}

// A later sibling's layout effect runs after the picker's layout effects and before any passive
// effect, so it sees exactly the filter state the first painted frame is built from.
function FirstFrame({ seen }: { seen: (state: { size: number; nearbyOnly: boolean }) => void }) {
  React.useLayoutEffect(() => {
    const { enabled, nearbyOnly } = useReportPickerFilters.getState()
    seen({ size: enabled.size, nearbyOnly })
  }, [seen])
  return null
}

describe("report picker filter reset", () => {
  it("resets filters left over from the last picker before the first frame is painted", () => {
    useReportPickerFilters.getState().clearAll()
    useReportPickerFilters.getState().setNearbyOnly(true)
    const seen = vi.fn()

    render(
      <>
        <Picker />
        <FirstFrame seen={seen} />
      </>,
    )

    expect(seen).toHaveBeenNthCalledWith(1, { size: PICKER_CATEGORIES.length, nearbyOnly: false })
  })
})
