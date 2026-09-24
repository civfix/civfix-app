import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { TicketTypeDTO } from "@civfix/shared"
import { resolveTicketTypeId } from "../registration/registrationModel"

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const read = (rel: string): string => code(readFileSync(new URL(rel, import.meta.url), "utf8"))

const type = (over: Partial<TicketTypeDTO> = {}): TicketTypeDTO => ({
  id: "tt1",
  cleanupId: "e1",
  name: "General",
  reserved: 0,
  sold: 0,
  visibility: "public",
  accessCodeSet: false,
  maxPartySize: 1,
  sortOrder: 0,
  questionIds: [],
  soldOut: false,
  salesOpen: true,
  waitlistEnabled: false,
  ...over,
})

const GENERAL = type({ id: "general", sortOrder: 0 })
const VIP = type({ id: "vip", sortOrder: 1 })

describe("resolveTicketTypeId", () => {
  it("starts on the default open type before the attendee picks", () => {
    expect(resolveTicketTypeId([GENERAL, VIP], null)).toBe("general")
  })

  it("keeps a pick that is still open, whatever the default is", () => {
    expect(resolveTicketTypeId([GENERAL, VIP], "vip")).toBe("vip")
  })

  it("moves off a pick that sold out on refetch to the next open type", () => {
    expect(resolveTicketTypeId([GENERAL, { ...VIP, soldOut: true }], "vip")).toBe("general")
  })

  it("moves off a pick whose sales closed", () => {
    expect(resolveTicketTypeId([GENERAL, { ...VIP, salesOpen: false }], "vip")).toBe("general")
  })

  it("moves off a pick the host deleted", () => {
    expect(resolveTicketTypeId([GENERAL], "vip")).toBe("general")
  })

  it("keeps a pick when nothing else is open either, rather than hopping between sold-out types", () => {
    const closed = [{ ...GENERAL, soldOut: true }, { ...VIP, soldOut: true }]
    expect(resolveTicketTypeId(closed, "vip")).toBe("vip")
  })

  it("has nothing to select on an event without types", () => {
    expect(resolveTicketTypeId([], "vip")).toBeNull()
  })
})

describe("both registration surfaces derive the selection from the live types", () => {
  it("never freezes the first default into state", () => {
    const block = read("../registration/RegistrationBlock.tsx")
    const walkup = read("../HostWalkupSheet.tsx")
    for (const src of [block, walkup]) {
      expect(src).toContain("resolveTicketTypeId(")
      expect(src).not.toContain("defaultTicketTypeId(")
    }
  })
})
