import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { HostStage } from "@civfix/shared/host"
import { hostRelativeLine } from "../hostModeCopy"
import { relativeLineFor } from "../hostSurfaceModel"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

const t = (key: string, options?: Record<string, unknown>): string =>
  options ? `${key}${JSON.stringify(options)}` : key

const unparsed = (): string => ""

describe("relativeLineFor", () => {
  it("phrases a relative time that could be computed", () => {
    expect(relativeLineFor("3h", (when) => `Starts in ${when}`)).toBe("Starts in 3h")
  })

  it("drops the line when the timestamp did not parse, instead of a dangling 'Starts in '", () => {
    expect(relativeLineFor("", (when) => `Starts in ${when}`)).toBeNull()
  })
})

describe("the host surfaces never render a relative phrase with nothing in it", () => {
  const base = { now: 1_000, startsAt: Number.NaN, endsAt: null, scheduledAt: "not a date" }

  it.each<HostStage>(["upcoming", "soon", "underway", "wrapping_up", "past"])(
    "hostRelativeLine drops the %s line when its time did not parse",
    (stage) => {
      expect(hostRelativeLine({ ...base, stage }, t, unparsed)).toBeNull()
    },
  )

  it("hostRelativeLine still says the event was called off, which needs no time", () => {
    expect(hostRelativeLine({ ...base, stage: "cancelled" }, t, unparsed)).toBe("phase.called_off")
  })

  it("hostRelativeLine routes each relative phrase through the helper", () => {
    const copy = read("../hostModeCopy.ts")
    expect(copy).toContain("relativeLineFor(relativeUntil(relative, input.startsAt, now), (when) =>")
    expect(copy).toContain('relativeLineFor(relative(input.scheduledAt, now), (when) => t("phase.started", { when }))')
    expect(copy).toContain("relativeLineFor(relative(input.endsAt ?? input.scheduledAt, now), (when) =>")
    expect(copy).not.toMatch(/t\("phase\.(starts|started|ended_on)", \{ when: relative/)
  })

  it("HostModeBody hands the nullable line straight to the phase header", () => {
    const body = read("../HostModeBody.tsx")
    expect(body).toContain("const relativeLine = hostRelativeLine(")
    expect(body).toContain("relative={relativeLine}")
  })

  it("PhaseHeader leaves out the relative caption and its separator when there is none", () => {
    const header = read("../PhaseHeader.tsx")
    expect(header).toContain("relative: string | null")
    expect(header).toMatch(/relative !== null \? \(/)
  })

  it("NextUpCard omits the when line rather than 'in ' with no time", () => {
    const card = read("../dashboard/NextUpCard.tsx")
    expect(card).toContain("relativeLineFor(")
    expect(card).toContain("relativeLineFor(relativeUntil(relative, Date.parse(event.startsAt), now), (rel) =>")
    expect(card).not.toMatch(/relative: relativeUntil\(relative, Date\.parse\(event\.startsAt\), now\)/)
    expect(card).toMatch(/whenLine !== null \? \(/)
  })
})
