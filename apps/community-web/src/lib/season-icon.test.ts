import { existsSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { iconPathFor } from "./season-icon"

describe("the browser-tab icon follows the season", () => {
  it("T10: picks the everyday or the christmas favicon, and the christmas one ships", () => {
    expect(iconPathFor("none")).toBe("/favicon.svg")
    expect(iconPathFor("christmas")).toBe("/favicon-christmas.svg")
    expect(existsSync(new URL("../../public/favicon-christmas.svg", import.meta.url))).toBe(true)
  })
})
