import { describe, expect, it } from "vitest"
import {
  ticketPageIndex,
  ticketPageWidth,
  ticketQrSize,
  ticketSeatIndex,
  ticketSeatOffset,
} from "../ticketModel"

const WINDOW = 1440
const SIDEBAR = 440

const seats = [{ id: "seat-a" }, { id: "seat-b" }, { id: "seat-c" }]

describe("ticketPageWidth", () => {
  it("takes the measured container width, not the window", () => {
    expect(ticketPageWidth(SIDEBAR)).toBe(SIDEBAR)
    expect(ticketPageWidth(SIDEBAR)).not.toBe(WINDOW)
  })

  it("reports 0 until the first layout lands", () => {
    expect(ticketPageWidth(0)).toBe(0)
    expect(ticketPageWidth(-1)).toBe(0)
    expect(ticketPageWidth(Number.NaN)).toBe(0)
  })

  it("floors a fractional measurement", () => {
    expect(ticketPageWidth(440.6)).toBe(440)
  })
})

describe("ticketQrSize", () => {
  it("fits the QR inside the measured page, not inside the window", () => {
    const narrow = 300
    expect(ticketQrSize(narrow)).toBe(narrow - 96)
    expect(ticketQrSize(narrow)).toBeLessThan(narrow)
  })

  it("clamps to the readable band at both ends", () => {
    expect(ticketQrSize(SIDEBAR)).toBe(260)
    expect(ticketQrSize(WINDOW)).toBe(260)
    expect(ticketQrSize(200)).toBe(160)
    expect(ticketQrSize(0)).toBe(160)
  })
})

describe("ticketPageIndex", () => {
  it("counts pages in the measured width", () => {
    expect(ticketPageIndex(0, SIDEBAR, seats.length)).toBe(0)
    expect(ticketPageIndex(SIDEBAR, SIDEBAR, seats.length)).toBe(1)
    expect(ticketPageIndex(SIDEBAR * 2, SIDEBAR, seats.length)).toBe(2)
  })

  it("would report the wrong seat if the window were used instead", () => {
    expect(ticketPageIndex(SIDEBAR * 2, WINDOW, seats.length)).toBe(1)
  })

  it("clamps into the seat range and survives an unmeasured pager", () => {
    expect(ticketPageIndex(SIDEBAR * 9, SIDEBAR, seats.length)).toBe(2)
    expect(ticketPageIndex(-200, SIDEBAR, seats.length)).toBe(0)
    expect(ticketPageIndex(SIDEBAR, 0, seats.length)).toBe(0)
    expect(ticketPageIndex(SIDEBAR, SIDEBAR, 0)).toBe(0)
  })
})

describe("ticketSeatIndex / ticketSeatOffset", () => {
  it("seeds a deep link on its own seat, at the measured offset", () => {
    const index = ticketSeatIndex(seats, "seat-c")
    expect(index).toBe(2)
    expect(ticketSeatOffset(index, SIDEBAR)).toBe(880)
    expect(ticketSeatOffset(index, WINDOW)).not.toBe(880)
  })

  it("falls back to the first seat for a missing or absent id", () => {
    expect(ticketSeatIndex(seats, undefined)).toBe(0)
    expect(ticketSeatIndex(seats, "seat-zzz")).toBe(0)
    expect(ticketSeatIndex(seats, "seat-a")).toBe(0)
    expect(ticketSeatOffset(0, SIDEBAR)).toBe(0)
    expect(ticketSeatOffset(2, 0)).toBe(0)
  })
})
