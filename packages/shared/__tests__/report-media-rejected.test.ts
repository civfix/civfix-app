import { describe, it, expect } from "vitest"
import { ReportDTOSchema } from "../src/schemas/entities.js"

const UUID = "123e4567-e89b-12d3-a456-426614174000"

function baseReport() {
  return {
    id: UUID,
    category: "trash" as const,
    status: "published" as const,
    visibility: "public" as const,
    lat: 34.05,
    lng: -118.24,
    geomSource: "device" as const,
    createdAt: "2026-06-01T12:00:00.000Z",
    mine: true,
    gov: false,
    following: false,
    media: [],
    timeline: [],
  }
}

describe("ReportDTO.mediaRejected", () => {
  it("defaults to 0 when a server does not send it", () => {
    expect(ReportDTOSchema.parse(baseReport()).mediaRejected).toBe(0)
  })

  it("carries the reporter's refused count", () => {
    expect(ReportDTOSchema.parse({ ...baseReport(), mediaRejected: 2 }).mediaRejected).toBe(2)
  })

  it("rejects a negative or fractional count", () => {
    expect(ReportDTOSchema.safeParse({ ...baseReport(), mediaRejected: -1 }).success).toBe(false)
    expect(ReportDTOSchema.safeParse({ ...baseReport(), mediaRejected: 1.5 }).success).toBe(false)
  })
})
