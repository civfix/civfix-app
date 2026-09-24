import { describe, expect, it } from "vitest"
import { CreateReportRequestSchema } from "@civfix/shared"
import type { ReportSubmission } from "../../data"
import { toCreateReportRequest } from "../submit"

const SUBMISSION: ReportSubmission = {
  idempotencyKey: "3f1c2b9a-6d4e-4c1a-9b7e-2a5d8c0f1e34",
  category: "graffiti",
  type: "other",
  lat: 34.05,
  lng: -118.24,
  geomSource: "device",
  mediaUploadIds: ["9c7b1e2d-4a3f-4e6b-8d1c-5f2a7b3c9e01"],
}

describe("toCreateReportRequest", () => {
  it("carries every required field through unchanged", () => {
    expect(toCreateReportRequest(SUBMISSION)).toEqual(SUBMISSION)
  })

  it("sends title, addr and description when the reporter filled them", () => {
    expect(
      toCreateReportRequest({ ...SUBMISSION, title: "Tag", addr: "1200 S Hope St", description: "On the wall" }),
    ).toEqual({ ...SUBMISSION, title: "Tag", addr: "1200 S Hope St", description: "On the wall" })
  })

  it("omits an empty optional field instead of sending an empty string", () => {
    const body = toCreateReportRequest({ ...SUBMISSION, title: "", addr: "", description: "" })
    expect(body).not.toHaveProperty("title")
    expect(body).not.toHaveProperty("addr")
    expect(body).not.toHaveProperty("description")
  })

  it("never invents the honeypot; the host adds it", () => {
    expect(toCreateReportRequest(SUBMISSION)).not.toHaveProperty("honeypot")
  })

  it("builds a body the contract's strict request schema accepts", () => {
    expect(
      CreateReportRequestSchema.safeParse(toCreateReportRequest({ ...SUBMISSION, title: "Tag" })).success,
    ).toBe(true)
  })
})
