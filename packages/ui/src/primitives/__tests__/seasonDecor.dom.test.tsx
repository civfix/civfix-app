import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { colorSchemes } from "@civfix/tokens"
import { Brand } from "../Brand"
import { SeasonGarland } from "../SeasonGarland"

// react-native-svg resolves to its native build under vitest; plain SVG elements keep the fills readable.
vi.mock("react-native-svg", () => {
  const shape =
    (Tag: "path" | "circle" | "rect" | "g") =>
    ({ fill, stroke, children }: { fill?: string; stroke?: string; children?: ReactNode }) => (
      <Tag fill={fill} stroke={stroke}>
        {children}
      </Tag>
    )
  return {
    default: ({ children }: { children?: ReactNode }) => <svg>{children}</svg>,
    Path: shape("path"),
    Circle: shape("circle"),
    Rect: shape("rect"),
    G: shape("g"),
  }
})

const L = colorSchemes.light

function rgb(hex: string): string {
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16)
  return `rgb(${n(1)}, ${n(3)}, ${n(5)})`
}

function fills(root: Element): string[] {
  return [...root.querySelectorAll("[fill]")].map((el) => el.getAttribute("fill") ?? "")
}

describe("the christmas wordmark", () => {
  it("wears a hat screen readers skip and taps pass through, and keeps its civfix label", () => {
    const { container } = render(<Brand size={24} />)
    expect(screen.getByLabelText("civfix")).toBeTruthy()
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    const hat = svg?.parentElement as HTMLElement
    expect(hat.getAttribute("aria-hidden")).toBe("true")
    expect(getComputedStyle(hat).pointerEvents).toBe("none")
    expect(fills(hat)).toEqual(expect.arrayContaining([L.bloom["700"], L.neutral.card]))
  })

  it("paints its letters red, gold and green", () => {
    render(<Brand size={24} />)
    expect(getComputedStyle(screen.getByText("c")).color).toBe(rgb(L.bloom["700"]))
    expect(getComputedStyle(screen.getByText("v")).color).toBe(rgb(L.moss["700"]))
  })
})

describe("the christmas garland", () => {
  it("draws holly in the light scheme's colors, hidden from screen readers and taps", () => {
    const { container } = render(<SeasonGarland width={288} />)
    const wrap = container.firstElementChild as HTMLElement
    expect(wrap.getAttribute("aria-hidden")).toBe("true")
    expect(getComputedStyle(wrap).pointerEvents).toBe("none")
    expect(new Set(fills(wrap))).toEqual(new Set(["none", L.moss["700"], L.bloom["700"]]))
    expect(wrap.querySelector("path[stroke]")?.getAttribute("stroke")).toBe(L.moss["600"])
  })

  it("draws nothing before the pill has a width", () => {
    const { container } = render(<SeasonGarland width={0} />)
    expect(container.firstElementChild).toBeNull()
  })
})
