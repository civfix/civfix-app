import { describe, it, expect } from "vitest"

import {
  ADDRESS_PRECISION_LADDER,
  comparePrecision,
  geocodePointKey,
  isLocatedPrecision,
  isVerifiedEventAddress,
  isVerifiedReportAddress,
  needsNearPrefix,
} from "../src/address.js"
import { roundGeocodeCoord } from "../src/geo.js"
import {
  AddressPrecisionSchema,
  CleanupDTOSchema,
  EventAddressSourceSchema,
  ReportAddressSourceSchema,
  ReportDTOSchema,
} from "../src/schemas/entities.js"
import {
  ResolveAddressRequestSchema,
  ResolveAddressResponseSchema,
} from "../src/schemas/map.js"
import {
  CreateCleanupRequestSchema,
  UpdateCleanupRequestSchema,
  MAX_EVENT_ADDRESS_LENGTH,
} from "../src/schemas/cleanups.js"
import { endpoints } from "../src/client/endpoints.js"

const UUID = "123e4567-e89b-12d3-a456-426614174000"

describe("address precision ladder", () => {
  it("orders the rungs from most to least specific", () => {
    expect([...ADDRESS_PRECISION_LADDER]).toEqual([
      "street",
      "intersection",
      "landmark",
      "locality",
    ])
    expect(AddressPrecisionSchema.options).toEqual([...ADDRESS_PRECISION_LADDER])
    expect(comparePrecision("street", "locality")).toBeLessThan(0)
    expect(comparePrecision("landmark", "intersection")).toBeGreaterThan(0)
    expect(comparePrecision("street", "street")).toBe(0)
  })

  it("treats street/intersection/landmark as located and locality/null as not", () => {
    expect(isLocatedPrecision("street")).toBe(true)
    expect(isLocatedPrecision("intersection")).toBe(true)
    expect(isLocatedPrecision("landmark")).toBe(true)
    expect(isLocatedPrecision("locality")).toBe(false)
    expect(isLocatedPrecision(null)).toBe(false)
    expect(isLocatedPrecision(undefined)).toBe(false)
  })

  it("asks for the Near prefix only on a landmark line", () => {
    expect(needsNearPrefix("landmark")).toBe(true)
    expect(needsNearPrefix("street")).toBe(false)
    expect(needsNearPrefix(null)).toBe(false)
  })
})

describe("address verification helpers", () => {
  it("counts any host-supplied event address source as verified", () => {
    expect(isVerifiedEventAddress("resolved", "123 Main St, Inglewood, CA")).toBe(true)
    expect(isVerifiedEventAddress("edited", "Boathouse dock, 123 Main St")).toBe(true)
    expect(isVerifiedEventAddress("manual", "Meet at the north gate")).toBe(true)
    expect(isVerifiedEventAddress(null, "123 Main St")).toBe(false)
    expect(isVerifiedEventAddress("resolved", "   ")).toBe(false)
    expect(isVerifiedEventAddress("resolved", null)).toBe(false)
  })

  it("counts a report address as verified only when typed or street-precision", () => {
    expect(isVerifiedReportAddress("user", null, "123 Main St")).toBe(true)
    expect(isVerifiedReportAddress("resolved", "street", "123 Main St")).toBe(true)
    expect(isVerifiedReportAddress("resolved", "landmark", "Vista Hermosa Park")).toBe(false)
    expect(isVerifiedReportAddress("resolved", "intersection", "Main St & 5th Ave")).toBe(false)
    expect(isVerifiedReportAddress("user", null, "")).toBe(false)
    expect(isVerifiedReportAddress(null, null, "123 Main St")).toBe(false)
  })
})

describe("geocode point key", () => {
  it("rounds to five decimals so a sub-metre pin nudge reuses one cache row", () => {
    expect(roundGeocodeCoord(34.052231234)).toBe(34.05223)
    expect(geocodePointKey({ lat: 34.052231234, lng: -118.243683999 })).toBe(
      "34.05223,-118.24368",
    )
    expect(geocodePointKey({ lat: 34.05223, lng: -118.24368 })).toBe(
      geocodePointKey({ lat: 34.0522302, lng: -118.2436799 }),
    )
  })

  it("pads a short coordinate to a stable key width", () => {
    expect(geocodePointKey({ lat: 34, lng: -118.5 })).toBe("34.00000,-118.50000")
  })
})

describe("resolve-address contract", () => {
  it("registers POST /map/resolve-address next to the other public map reads", () => {
    const e = endpoints.resolveAddress
    expect(e.method).toBe("POST")
    expect(e.path).toBe("/map/resolve-address")
    expect(e.auth).toBe("optional")
    expect(e.csrf).toBe(false)
    expect(e.version).toBe("v1")
    expect(e.request).toBe(ResolveAddressRequestSchema)
    expect(e.response).toBe(ResolveAddressResponseSchema)
  })

  it("takes a strict lat/lng and answers a line plus the rung it reached", () => {
    expect(ResolveAddressRequestSchema.parse({ lat: 34.05, lng: -118.24 })).toEqual({
      lat: 34.05,
      lng: -118.24,
    })
    expect(ResolveAddressRequestSchema.safeParse({ lat: 34.05, lng: -118.24, zoom: 14 }).success).toBe(
      false,
    )
    expect(ResolveAddressRequestSchema.safeParse({ lat: 91, lng: -118.24 }).success).toBe(false)

    expect(
      ResolveAddressResponseSchema.parse({
        address: "123 Main St, Inglewood, CA",
        precision: "street",
        cityStateLabel: "Inglewood, CA",
      }),
    ).toEqual({
      address: "123 Main St, Inglewood, CA",
      precision: "street",
      cityStateLabel: "Inglewood, CA",
    })
    expect(
      ResolveAddressResponseSchema.parse({
        address: null,
        precision: null,
        cityStateLabel: "Los Angeles, CA",
      }).address,
    ).toBeNull()
    expect(
      ResolveAddressResponseSchema.safeParse({
        address: null,
        precision: "block",
        cityStateLabel: "Los Angeles, CA",
      }).success,
    ).toBe(false)
  })
})

describe("event and report address source fields", () => {
  it("keeps addressSource additive on the cleanup DTO", () => {
    const base = {
      id: UUID,
      title: "Ballona Creek cleanup",
      type: "site",
      lat: 34.05,
      lng: -118.24,
      scheduledAt: "2026-10-01T17:00:00.000Z",
      status: "upcoming",
      organizer: { id: UUID, name: "Ada", handle: "ada", followers: 0, following: 0, isFollowing: false },
      going: 3,
      joined: false,
      bring: [],
    }
    expect(CleanupDTOSchema.parse(base).addressSource).toBeUndefined()
    expect(
      CleanupDTOSchema.parse({ ...base, address: "123 Main St", addressSource: "edited" })
        .addressSource,
    ).toBe("edited")
    expect(CleanupDTOSchema.safeParse({ ...base, addressSource: "user" }).success).toBe(false)
    expect(EventAddressSourceSchema.options).toEqual(["resolved", "edited", "manual"])
  })

  it("accepts an optional addressSource on create and update, address still optional", () => {
    const create = {
      title: "Ballona Creek cleanup",
      type: "site" as const,
      lat: 34.05,
      lng: -118.24,
      scheduledAt: "2026-10-01T17:00:00.000Z",
    }
    expect(CreateCleanupRequestSchema.parse(create).address).toBeUndefined()
    expect(
      CreateCleanupRequestSchema.parse({
        ...create,
        address: "123 Main St, Inglewood, CA",
        addressSource: "resolved",
      }).addressSource,
    ).toBe("resolved")
    expect(
      CreateCleanupRequestSchema.safeParse({
        ...create,
        address: "x".repeat(MAX_EVENT_ADDRESS_LENGTH + 1),
      }).success,
    ).toBe(false)
    expect(
      UpdateCleanupRequestSchema.parse({ id: UUID, address: "Meet at the gate", addressSource: "manual" })
        .addressSource,
    ).toBe("manual")
    expect(
      UpdateCleanupRequestSchema.safeParse({ id: UUID, addressSource: "typed" }).success,
    ).toBe(false)
  })

  it("carries addrSource and addrPrecision on the report DTO", () => {
    const base = {
      id: UUID,
      category: "trash",
      status: "published",
      visibility: "public",
      lat: 34.05,
      lng: -118.24,
      geomSource: "device",
      createdAt: "2026-09-16T17:00:00.000Z",
      mine: false,
      gov: false,
      following: false,
      media: [],
      timeline: [],
    }
    const parsed = ReportDTOSchema.parse(base)
    expect(parsed.addrSource).toBeUndefined()
    expect(parsed.addrPrecision).toBeUndefined()
    const located = ReportDTOSchema.parse({
      ...base,
      addr: "Vista Hermosa Park, Los Angeles, CA",
      addrSource: "resolved",
      addrPrecision: "landmark",
    })
    expect(located.addrSource).toBe("resolved")
    expect(needsNearPrefix(located.addrPrecision)).toBe(true)
    expect(ReportDTOSchema.safeParse({ ...base, addrSource: "manual" }).success).toBe(false)
    expect(ReportAddressSourceSchema.options).toEqual(["resolved", "user"])
  })
})
