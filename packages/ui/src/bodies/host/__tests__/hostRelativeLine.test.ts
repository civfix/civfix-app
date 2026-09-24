import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { relativeLineFor } from "../hostSurfaceModel"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

describe("relativeLineFor", () => {
  it("phrases a relative time that could be computed", () => {
    expect(relativeLineFor("3h", (when) => `Starts in ${when}`)).toBe("Starts in 3h")
  })

  it("drops the line when the timestamp did not parse, instead of a dangling 'Starts in '", () => {
    expect(relativeLineFor("", (when) => `Starts in ${when}`)).toBeNull()
  })
})

describe("the host surfaces never render a relative phrase with nothing in it", () => {
  it("HostModeBody routes each relative phrase through the helper", () => {
    const body = read("../HostModeBody.tsx")
    expect(body).toContain('relativeLineFor(relative(now, startsAt), (when) => t("phase.starts", { when }))')
    expect(body).not.toMatch(/t\("phase\.(starts|started|ended_on)", \{ when: relative\(/)
  })

  it("PhaseHeader leaves out the relative caption and its separator when there is none", () => {
    const header = read("../PhaseHeader.tsx")
    expect(header).toContain("relative: string | null")
    expect(header).toMatch(/relative !== null \? \(/)
  })

  it("NextUpCard omits the when line rather than 'in ' with no time", () => {
    const card = read("../dashboard/NextUpCard.tsx")
    expect(card).toContain("relativeLineFor(")
    expect(card).not.toMatch(/relative: relative\(now, Date\.parse\(event\.startsAt\)\)/)
    expect(card).toMatch(/whenLine !== null \? \(/)
  })
})
