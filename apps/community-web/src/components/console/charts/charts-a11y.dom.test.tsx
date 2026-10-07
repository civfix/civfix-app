import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Donut } from "./donut"
import { FunnelRibbon } from "./funnel"
import { HBarRanked } from "./hbar-ranked"
import { Histogram } from "./histogram"
import { LineArea } from "./line-area"
import { StackedBars } from "./stacked-bars"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const SUMMARY = "Sign-ups by week"

function measureAt(width: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width,
    height: 200,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: 200,
    toJSON: () => ({}),
  })
}

describe("chart summaries", () => {
  it.each([
    ["Histogram", () => <Histogram bins={[{ label: "Mon", count: 2 }]} summary={SUMMARY} valueLabel="Count" />],
    ["StackedBars", () => (
      <StackedBars labels={["Mon"]} series={[{ id: "a", label: "A", values: [2] }]} summary={SUMMARY} suppressedLabel="-" />
    )],
    ["LineArea", () => (
      <LineArea labels={["Mon", "Tue"]} series={[{ id: "a", label: "A", values: [1, 2] }]} summary={SUMMARY} suppressedLabel="-" />
    )],
    ["Donut", () => <Donut segments={[{ id: "a", label: "A", value: 2 }]} summary={SUMMARY} />],
  ])("%s names its image once, with no duplicate sr-only copy", (_name, make) => {
    measureAt(400)
    render(make())
    expect(screen.getByRole("img", { name: SUMMARY })).toBeTruthy()
    expect(screen.queryByText(SUMMARY)).toBeNull()
  })

  it.each([
    ["Histogram", () => <Histogram bins={[{ label: "Mon", count: 2 }]} summary={SUMMARY} valueLabel="Count" />],
    ["StackedBars", () => (
      <StackedBars labels={["Mon"]} series={[{ id: "a", label: "A", values: [2] }]} summary={SUMMARY} suppressedLabel="-" />
    )],
    ["LineArea", () => (
      <LineArea labels={["Mon", "Tue"]} series={[{ id: "a", label: "A", values: [1, 2] }]} summary={SUMMARY} suppressedLabel="-" />
    )],
  ])("%s still exposes its summary before it has been measured", (_name, make) => {
    measureAt(0)
    render(make())
    expect(screen.getByRole("img", { name: SUMMARY })).toBeTruthy()
  })

  it("draws distinct y-axis labels for a near-empty histogram", () => {
    measureAt(400)
    const { container } = render(
      <Histogram bins={[{ label: "Mon", count: 0 }, { label: "Tue", count: 1 }]} summary={SUMMARY} valueLabel="Count" />,
    )
    const axis = [...container.querySelectorAll("text[text-anchor='end']")].map((el) => el.textContent)
    expect(axis).toEqual(["0", "1"])
  })

  it("does not turn the hover tooltip into a live region", () => {
    measureAt(400)
    const { container } = render(
      <Histogram bins={[{ label: "Mon", count: 2 }]} summary={SUMMARY} valueLabel="Count" />,
    )
    fireEvent.mouseEnter(container.querySelector("rect") as Element)
    expect(screen.getByText("Count")).toBeTruthy()
    expect(screen.queryByRole("status")).toBeNull()
  })
})

describe("FunnelRibbon", () => {
  it("presents its stages as a named list of plain data, not disabled buttons", () => {
    render(
      <FunnelRibbon
        summary={SUMMARY}
        stages={[
          { id: "views", label: "Views", value: "120" },
          { id: "signups", label: "Sign-ups", value: "30" },
        ]}
      />,
    )
    expect(screen.queryAllByRole("button")).toHaveLength(0)
    const list = screen.getByRole("list", { name: SUMMARY })
    expect(list.querySelectorAll("[role='listitem']")).toHaveLength(2)
    expect(screen.queryByText(SUMMARY)).toBeNull()
  })
})

describe("HBarRanked", () => {
  it("keeps only listitems inside its list, each carrying its row as plain data", () => {
    render(<HBarRanked summary={SUMMARY} items={[{ id: "a", label: "Park", value: 3 }]} />)
    const list = screen.getByRole("list", { name: SUMMARY })
    for (const child of list.children) expect(child.getAttribute("role")).toBe("listitem")
    const items = screen.getAllByRole("listitem")
    expect(items).toHaveLength(1)
    expect(items[0]?.textContent).toContain("Park")
    expect(screen.queryAllByRole("button")).toHaveLength(0)
  })
})
