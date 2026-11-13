import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { tokens } from "@civfix/tokens"
import type * as Season from "../../theme/season"
import { Brand } from "../Brand"
import { SeasonGarland } from "../SeasonGarland"

vi.mock("../../theme/season", async (importOriginal) => ({
  ...(await importOriginal<typeof Season>()),
  ACTIVE_SEASON: "none",
}))

vi.mock("react-native-svg", () => ({ default: () => <svg /> }))

describe("with the season switched off", () => {
  it("the wordmark has no hat and keeps its label", () => {
    const { container } = render(<Brand size={24} />)
    expect(screen.getByLabelText("civfix")).toBeTruthy()
    expect(container.querySelector("svg")).toBeNull()
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  it("the wordmark keeps today's letter colors", () => {
    render(<Brand size={24} />)
    const hex = tokens.color.brand.sky
    const n = (i: number) => parseInt(hex.slice(i, i + 2), 16)
    expect(getComputedStyle(screen.getByText("f")).color).toBe(`rgb(${n(1)}, ${n(3)}, ${n(5)})`)
  })

  it("the navigation has no garland", () => {
    const { container } = render(<SeasonGarland width={288} />)
    expect(container.firstElementChild).toBeNull()
  })
})
