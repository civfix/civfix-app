import * as React from "react"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { Sparkline } from "./sparkline"

afterEach(cleanup)

function lines(container: HTMLElement): SVGPathElement[] {
  return [...container.querySelectorAll("path")].filter(
    (path) => path.getAttribute("fill") === "none",
  )
}

describe("Sparkline", () => {
  it("draws one line through an unsuppressed series", () => {
    const { container } = render(<Sparkline values={[1, 2, 3, 4]} label="trend" />)
    expect(lines(container)).toHaveLength(1)
  })

  it("breaks the line at a suppressed point rather than dipping to zero", () => {
    const { container } = render(<Sparkline values={[8, 9, null, 9, 8]} label="trend" />)
    const drawn = lines(container)
    expect(drawn).toHaveLength(2)
    for (const path of drawn) {
      expect(path.getAttribute("d")).not.toMatch(/^$/)
    }
  })

  it("never plots a suppressed point on the zero baseline", () => {
    const { container } = render(
      <Sparkline values={[5, 5, null, 5, 5]} height={28} label="trend" />,
    )
    const baselineY = "26.0"
    const drawn = lines(container)
    expect(drawn).toHaveLength(2)
    for (const path of drawn) {
      expect(path.getAttribute("d")).not.toContain(baselineY)
    }
  })

  it("does not bridge a gap between two isolated points", () => {
    const { container } = render(<Sparkline values={[10, null, 12]} label="trend" />)
    expect(lines(container)).toHaveLength(0)
    expect(container.querySelectorAll("circle").length).toBeGreaterThanOrEqual(2)
  })

  it("renders nothing when fewer than two points survive suppression", () => {
    const { container } = render(<Sparkline values={[null, 4, null]} label="trend" />)
    expect(container.querySelector("svg")).toBeNull()
  })

  it("renders nothing for an entirely suppressed series", () => {
    const { container } = render(<Sparkline values={[null, null, null]} label="trend" />)
    expect(container.querySelector("svg")).toBeNull()
  })
})
