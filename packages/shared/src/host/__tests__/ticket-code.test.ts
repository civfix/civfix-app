import { describe, expect, it } from "vitest"
import { TICKET_TOKEN_MAX, TICKET_TOKEN_MIN } from "../../schemas/host/checkin.js"
import { formatTicketCode, normalizeTicketCode, ticketCodeReady } from "../ticket-code.js"

describe("normalizeTicketCode", () => {
  it("MIRRORS the server's normalizer: strip whitespace AND hyphens, then uppercase", () => {
    expect(normalizeTicketCode("  ab cd\tef  ")).toBe("ABCDEF")
    expect(normalizeTicketCode("ABCD-EFGH-IJKL")).toBe("ABCDEFGHIJKL")
    expect(normalizeTicketCode("abcd efgh-ijkl")).toBe("ABCDEFGHIJKL")
  })

  it("round-trips the printed ticket code back to the raw token", () => {
    const token = "K7Q2M4X9B3TF6HZP8RJ5WNCVDA"
    expect(normalizeTicketCode(formatTicketCode(token))).toBe(token)
  })
})

describe("ticketCodeReady", () => {
  it("accepts only lengths the contract's ticket-token schema accepts", () => {
    expect(ticketCodeReady("a".repeat(TICKET_TOKEN_MIN - 1))).toBe(false)
    expect(ticketCodeReady("a".repeat(TICKET_TOKEN_MIN))).toBe(true)
    expect(ticketCodeReady("a".repeat(TICKET_TOKEN_MAX))).toBe(true)
    expect(ticketCodeReady("a".repeat(TICKET_TOKEN_MAX + 1))).toBe(false)
    expect(ticketCodeReady("  " + "a".repeat(TICKET_TOKEN_MIN) + "  ")).toBe(true)
  })

  it("counts the token, not the grouping a host typed or pasted", () => {
    expect(ticketCodeReady("abcd-efg")).toBe(false)
    expect(ticketCodeReady("abcd-efgh")).toBe(true)
    expect(ticketCodeReady(normalizeTicketCode("abcd efgh"))).toBe(true)
  })
})

describe("formatTicketCode", () => {
  it("prints the WHOLE token, never a prefix", () => {
    const token = "K7Q2M4X9B3TF6HZP8RJ5WNCVDA"
    const printed = formatTicketCode(token)
    expect(printed.replace(/-/g, "")).toBe(token)
    expect(printed.replace(/-/g, "")).toHaveLength(token.length)
  })

  it("groups for legibility and uppercases", () => {
    expect(formatTicketCode("abcdefghij")).toBe("ABCD-EFGH-IJ")
    expect(formatTicketCode("")).toBe("")
  })

  it("regroups a code typed with its own spacing instead of nesting the separators", () => {
    expect(formatTicketCode(" abcd efgh-ij ")).toBe("ABCD-EFGH-IJ")
    expect(formatTicketCode("ABCD-EFGH")).toBe("ABCD-EFGH")
  })

  it("never grows a pasted code past the longest token the contract accepts", () => {
    const printed = formatTicketCode("a".repeat(TICKET_TOKEN_MAX + 10))
    expect(printed.replace(/-/g, "")).toHaveLength(TICKET_TOKEN_MAX)
  })
})
