/**
 * The /map/suggest wire body. The load-bearing assertion is the ABSENT `language` key: the deployed
 * backend parses this body with a `.strict()` schema that has no such field, so an extra key is a 422 and
 * address autocomplete silently goes dead (AddressSearch swallows the error into an empty dropdown).
 */
import { describe, expect, it } from "vitest"
import { SuggestPlacesRequestSchema } from "@civfix/shared"
import { ADDRESS_SUGGEST_LIMIT, buildSuggestRequest } from "../addressSuggestRequest"

describe("address suggest request", () => {
  it("sends only q + limit when there is no bias", () => {
    expect(buildSuggestRequest("1600 penn")).toEqual({ q: "1600 penn", limit: ADDRESS_SUGGEST_LIMIT })
  })

  it("carries the map-viewport bias when one resolved", () => {
    expect(
      buildSuggestRequest("main st", { proximity: { lat: 34.05, lng: -118.24 }, proximityZoom: 13 }),
    ).toEqual({
      q: "main st",
      limit: ADDRESS_SUGGEST_LIMIT,
      proximity: { lat: 34.05, lng: -118.24 },
      proximityZoom: 13,
    })
  })

  it("omits an unresolved bias rather than sending null/undefined keys", () => {
    expect(buildSuggestRequest("main st", { proximity: null })).toEqual({
      q: "main st",
      limit: ADDRESS_SUGGEST_LIMIT,
    })
  })

  it("never puts a `language` key on the wire (the deployed strict schema 422s unknown keys)", () => {
    const body = buildSuggestRequest("café", { proximity: { lat: 1, lng: 2 }, proximityZoom: 11 })
    expect(Object.keys(body)).not.toContain("language")
    // The published (deployed) schema has no `language` key at all, so parsing this body with a strict
    // object of exactly the OLD field set is the regression gate: any new key fails it.
    const deployedSchema = SuggestPlacesRequestSchema.omit({ language: true }).strict()
    expect(deployedSchema.safeParse(body).success).toBe(true)
  })
})
