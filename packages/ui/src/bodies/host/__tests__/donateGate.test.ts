import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { DonateStateSchema } from "@civfix/shared"
import { donationsOffered } from "../../../data/hooks/donations"

const SRC = fileURLToPath(new URL("../../../", import.meta.url))
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8")

describe("donationsOffered", () => {
  it("is READY and nothing else", () => {
    for (const state of DonateStateSchema.options) {
      expect(donationsOffered(state), state).toBe(state === "READY")
    }
    expect(donationsOffered(null)).toBe(false)
    expect(donationsOffered(undefined)).toBe(false)
  })
})

describe("DonateBlock's callers pass a REAL donateState", () => {
  it("DonateBlock itself gates on READY", () => {
    expect(read("primitives/DonateBlock.tsx")).toContain('org.donateState !== "READY"')
  })

  it("EventDetailBody never synthesizes the state from `donationOrg.enabled`", () => {
    const detail = read("bodies/EventDetailBody.tsx")
    expect(detail).not.toMatch(/donateState:\s*[^,\n]*\?\s*"READY"/)
    expect(detail).not.toMatch(/donateState:\s*"READY"/)
    expect(detail).toContain("donateState: donatePage.data.donateState")
  })

  it("both callers read the state from the same authoritative public endpoint", () => {
    for (const rel of ["bodies/EventDetailBody.tsx", "bodies/host/OrgPageBody.tsx"]) {
      expect(read(rel), rel).toMatch(/useOrgDonationPage\(/)
    }
  })
})
