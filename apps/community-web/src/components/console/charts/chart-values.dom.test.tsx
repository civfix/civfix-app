import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { LineArea, type LineAreaProps } from "./line-area"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const WIDTH = 400

function measure() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: WIDTH,
    height: 200,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: WIDTH,
    bottom: 200,
    toJSON: () => ({}),
  })
}

function chart(values: LineAreaProps["series"][number]["values"]) {
  return (
    <LineArea
      labels={["Mon", "Tue"]}
      series={[{ id: "signups", label: "Sign-ups", values }]}
      summary="Sign-ups by day"
      suppressedLabel="-"
    />
  )
}

function axisLabels(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll("text[text-anchor='end']")].map((el) => el.textContent)
}

describe("console chart values", () => {
  it("labels the y axis with the shared compact count format", () => {
    measure()
    const { container } = render(chart([400, 1500]))
    expect(axisLabels(container)).toEqual(["0", "500", "1K", "1.5K"])
  })

  it("updates the open tooltip when the data changes under the pointer", () => {
    measure()
    const { container, rerender, getByText, queryByText } = render(chart([3, 7]))
    fireEvent.mouseMove(container.querySelector("svg") as Element, { clientX: WIDTH - 1, clientY: 50 })
    expect(getByText("7")).toBeTruthy()

    rerender(chart([3, 9]))
    expect(getByText("9")).toBeTruthy()
    expect(queryByText("7")).toBeNull()
  })
})
