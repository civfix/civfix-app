import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type * as ReactNative from "react-native"
import { I18nProvider } from "../../../i18n"
import type { NearbyReportRow } from "../../linkReportsModel"
import { DuplicateMatchCard } from "../DuplicateMatchCard"

// The icon set pulls in native-only modules; the card is read by its text.
vi.mock("../../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return { Text, Icon: () => null, iconMap: {} }
})
vi.mock("../../../primitives", () => ({ CATEGORY_ICONS: {}, MetaDot: () => null }))

function row(over: Partial<NearbyReportRow["pin"]>, distanceM: number): NearbyReportRow {
  return {
    pin: { id: "r1", category: "trash", status: "published", lat: 34.1, lng: -118.3, confirmCount: 0, ...over },
    distanceM,
  }
}

function renderCard(match: NearbyReportRow, onOpen = vi.fn()) {
  render(
    <I18nProvider locale="en">
      <DuplicateMatchCard row={match} width={undefined} onOpen={onOpen} />
    </I18nProvider>,
  )
  return onOpen
}

describe("DuplicateMatchCard", () => {
  it("shows the title, category, rounded distance and the neighbor count", () => {
    renderCard(row({ title: "Overflowing bin", confirmCount: 3 }, 11.2))
    expect(screen.getByText("Overflowing bin")).toBeTruthy()
    expect(screen.getByText("Trash")).toBeTruthy()
    expect(screen.getByText("About 10 m away")).toBeTruthy()
    expect(screen.getByText("3 neighbors saw this too")).toBeTruthy()
  })

  it("reads less than 5 m when close, falls back to the category for a missing title, and hides a zero count", () => {
    renderCard(row({ title: null, confirmCount: 0 }, 3))
    expect(screen.getAllByText("Trash")).toHaveLength(2)
    expect(screen.getByText("Less than 5 m away")).toBeTruthy()
    expect(screen.queryByText(/saw this too/)).toBeNull()
  })

  it("opens its own match when pressed", () => {
    const match = row({ title: "Overflowing bin" }, 8)
    const onOpen = renderCard(match)
    fireEvent.click(screen.getByRole("button", { name: /^Overflowing bin/ }))
    expect(onOpen).toHaveBeenCalledWith(match)
  })

  it("gives a screen reader the distance and the neighbor count, not only the title", () => {
    renderCard(row({ title: "Overflowing bin", confirmCount: 3 }, 11.2))
    const card = screen.getByRole("button")
    expect(card.getAttribute("aria-label")).toBeNull()
    expect(card).toHaveProperty("textContent", "Overflowing binTrashAbout 10 m away3 neighbors saw this too")
    expect(screen.getByRole("button", { name: /About 10 m away.*3 neighbors saw this too/ })).toBe(card)
  })
})
