import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type * as ReactNative from "react-native"
import { I18nProvider } from "../../../i18n"
import { useNavStore } from "../../../nav"
import type { NearbyReportRow } from "../../linkReportsModel"
import { DuplicateGate } from "../DuplicateGate"

// The icon set pulls in native-only modules; the screen is read by its text.
vi.mock("../../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return { Text, Icon: () => null, iconMap: {} }
})
vi.mock("../../../primitives", () => ({ CATEGORY_ICONS: {}, MetaDot: () => null }))

const match: NearbyReportRow = {
  pin: { id: "r1", category: "trash", status: "published", lat: 34.1, lng: -118.3, confirmCount: 0, title: "Overflowing bin" },
  distanceM: 8,
}

beforeEach(() => {
  useNavStore.getState().reset()
  useNavStore.getState().selectView("report")
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("DuplicateGate", () => {
  it("shows on web without logging a console error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    render(
      <I18nProvider locale="en">
        <DuplicateGate rows={[match]} onOpen={vi.fn()} onBack={vi.fn()} />
      </I18nProvider>,
    )
    expect(screen.getByText("Overflowing bin")).toBeTruthy()
    expect(consoleError).not.toHaveBeenCalled()
  })
})
