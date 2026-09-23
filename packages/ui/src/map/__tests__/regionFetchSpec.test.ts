import { describe, expect, it } from "vitest"
import { AGGREGATE_EXPAND_ZOOM } from "../clusterer"
import { REGION_FETCH_CONSTANTS } from "./regionFetchSpec"

describe("region-fetch spec", () => {
  it("puts the server pin zoom where the shared clusterer stops expanding aggregates", () => {
    expect(REGION_FETCH_CONSTANTS.SERVER_PIN_ZOOM).toBe(AGGREGATE_EXPAND_ZOOM)
  })
})
