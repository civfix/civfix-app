/**
 * `useResolveJurisdiction` rethrows a transient failure so it is not cached, so the route card needs its own
 * error state or it reads "Resolving where this routes..." forever. The body renders RN, so its wiring is
 * pinned by source.
 */
import { readFileSync } from "node:fs"
import type { JurisdictionDTO } from "@civfix/shared"
import { describe, expect, it } from "vitest"
import { sliceBetween } from "../../__tests__/sourceGuards"
import { routeCardState } from "../routeCard"

const jd = (routable: boolean) =>
  ({ id: "j1", name: "City of Oakland", routable, cityStateLabel: "Oakland, CA" }) as unknown as JurisdictionDTO

const idle = { data: undefined, isError: false, isFetching: false }

describe("routeCardState", () => {
  it("asks for a point first", () => {
    expect(routeCardState(false, { ...idle, data: jd(true) })).toEqual({ kind: "no_point" })
  })

  it("names a routable jurisdiction, flags a new area, and says when nothing covers the point", () => {
    expect(routeCardState(true, { ...idle, data: jd(true) })).toEqual({ kind: "routable", name: "City of Oakland" })
    expect(routeCardState(true, { ...idle, data: jd(false) })).toEqual({ kind: "new_area", cityState: "Oakland, CA" })
    expect(routeCardState(true, { ...idle, data: null })).toEqual({ kind: "uncovered" })
  })

  it("stops resolving and offers a retry when the lookup failed", () => {
    expect(routeCardState(true, { data: undefined, isError: true, isFetching: false })).toEqual({ kind: "unavailable" })
  })

  it("reads as resolving while the first lookup or a retry is in flight", () => {
    expect(routeCardState(true, { data: undefined, isError: false, isFetching: true })).toEqual({ kind: "resolving" })
    expect(routeCardState(true, { data: undefined, isError: true, isFetching: true })).toEqual({ kind: "resolving" })
  })

  it("keeps showing an answer it already has when a background refetch fails", () => {
    expect(routeCardState(true, { data: jd(true), isError: true, isFetching: false }).kind).toBe("routable")
  })
})

describe("the review step's route card", () => {
  const body = readFileSync(new URL("../../bodies/reportFlow/ReviewStep.tsx", import.meta.url), "utf8")
  const flat = body.replace(/\s+/g, " ")

  it("renders the unavailable state with a retry that refetches the lookup", () => {
    expect(flat).toContain("const route = routeCardState(point !== null, jurisdiction)")
    const unavailable = sliceBetween(flat, 'case "unavailable":', "default:")
    expect(unavailable).toContain('t("review.route_unavailable")')
    expect(unavailable).toContain("onPress={() => void jurisdiction.refetch()}")
  })

  it("has copy for the unavailable state in every locale", () => {
    for (const locale of ["en", "es", "de", "ko"]) {
      const catalog = JSON.parse(
        readFileSync(new URL(`../../i18n/locales/${locale}/report-wizard.json`, import.meta.url), "utf8"),
      ) as { review: Record<string, string> }
      expect(catalog.review.route_unavailable, locale).toMatch(/\S/)
    }
  })
})
