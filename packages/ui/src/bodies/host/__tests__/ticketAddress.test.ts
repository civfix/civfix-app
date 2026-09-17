import { describe, expect, it } from "vitest"
import { ticketAddressView } from "../ticketModel"

const TICKET = { address: "123 Main St, Inglewood, CA" }
const EVENT = {
  lat: 34.05223,
  lng: -118.24368,
  address: "123 Main St, Inglewood, CA",
  addressSource: "resolved" as const,
}

describe("ticketAddressView", () => {
  it("carries the event coordinates so an external map never has to guess from text", () => {
    expect(ticketAddressView(TICKET, EVENT)).toEqual({
      address: "123 Main St, Inglewood, CA",
      point: { lat: 34.05223, lng: -118.24368 },
      verified: true,
    })
  })

  it("stops claiming verified for an event that carries no source", () => {
    expect(ticketAddressView(TICKET, { ...EVENT, addressSource: null }).verified).toBe(false)
  })

  it("degrades to a copy-only line while the event is still loading", () => {
    expect(ticketAddressView(TICKET, null)).toEqual({
      address: "123 Main St, Inglewood, CA",
      point: null,
      verified: false,
    })
    expect(ticketAddressView(TICKET, undefined).verified).toBe(false)
  })

  it("falls back to the event address when the ticket snapshot has none", () => {
    expect(ticketAddressView({ address: "  " }, EVENT).address).toBe("123 Main St, Inglewood, CA")
    expect(ticketAddressView({ address: null }, { ...EVENT, address: null })).toEqual({
      address: null,
      point: { lat: 34.05223, lng: -118.24368 },
      verified: false,
    })
  })

  it("has no point to offer when the event lost its coordinates", () => {
    expect(ticketAddressView(TICKET, { ...EVENT, lat: null, lng: null }).point).toBeNull()
  })
})
