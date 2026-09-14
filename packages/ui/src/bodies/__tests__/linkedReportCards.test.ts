import { beforeEach, describe, expect, it } from "vitest"
import type { LinkedReportRef, ReportPinDTO } from "@civfix/shared"
import {
  linkedRefToCardData,
  pinToCardData,
  sameCardEntry,
  useLinkedReportCards,
  type LinkedReportCardEntry,
} from "../linkedReportCards"

const PIN: ReportPinDTO = {
  id: "r1",
  category: "trash",
  status: "published",
  lat: 34.05,
  lng: -118.24,
}

const REF: LinkedReportRef = {
  id: "r2",
  category: "graffiti",
  title: "Tagged wall",
  status: "acknowledged",
  lat: 34.06,
  lng: -118.25,
  linkedAt: "2026-09-13T00:00:00.000Z",
}

describe("pinToCardData", () => {
  it("carries the point through so a row can print its distance", () => {
    expect(pinToCardData(PIN)).toEqual({
      id: "r1",
      category: "trash",
      status: "published",
      lat: 34.05,
      lng: -118.24,
    })
  })

  it("omits the optional fields the pin did not carry rather than writing undefined", () => {
    const card = pinToCardData(PIN)
    for (const key of ["type", "title", "description", "thumbUrl", "addr", "referenceCode"]) {
      expect(Object.hasOwn(card, key), key).toBe(false)
    }
  })

  it("keeps every optional field the pin DID carry, including an explicit null", () => {
    const card = pinToCardData({
      ...PIN,
      type: "dump",
      title: null,
      description: "By the fence",
      thumbUrl: "https://example.test/t.jpg",
      addr: "1200 S Hope St",
      referenceCode: "DU-42-000118",
    })
    expect(card.type).toBe("dump")
    expect(Object.hasOwn(card, "title")).toBe(true)
    expect(card.title).toBeNull()
    expect(card.addr).toBe("1200 S Hope St")
    expect(card.referenceCode).toBe("DU-42-000118")
  })
})

describe("linkedRefToCardData", () => {
  it("maps the event's own linked ref, which never carries a reference code", () => {
    expect(linkedRefToCardData(REF)).toEqual({
      id: "r2",
      category: "graffiti",
      status: "acknowledged",
      title: "Tagged wall",
      lat: 34.06,
      lng: -118.25,
    })
    expect(Object.hasOwn(linkedRefToCardData(REF), "referenceCode")).toBe(false)
  })

  it("keeps the address and thumb when the server sent them", () => {
    const card = linkedRefToCardData({ ...REF, addr: "1180 S Hope St", thumbUrl: null })
    expect(card.addr).toBe("1180 S Hope St")
    expect(Object.hasOwn(card, "thumbUrl")).toBe(true)
  })
})

describe("sameCardEntry", () => {
  const base: LinkedReportCardEntry = pinToCardData(PIN)

  it("is false against a missing entry", () => {
    expect(sameCardEntry(undefined, base)).toBe(false)
  })

  it("treats a re-mapped identical pin as unchanged", () => {
    expect(sameCardEntry(base, pinToCardData(PIN))).toBe(true)
  })

  it("notices a status flip or a fresh thumbnail", () => {
    expect(sameCardEntry(base, pinToCardData({ ...PIN, status: "resolved" }))).toBe(false)
    expect(sameCardEntry(base, pinToCardData({ ...PIN, thumbUrl: "https://x.test/a.jpg" }))).toBe(
      false,
    )
  })
})

describe("the display cache", () => {
  beforeEach(() => {
    useLinkedReportCards.getState().clear()
  })

  it("puts cards under their id", () => {
    useLinkedReportCards.getState().put([pinToCardData(PIN), linkedRefToCardData(REF)])
    expect(Object.keys(useLinkedReportCards.getState().cards).sort()).toEqual(["r1", "r2"])
  })

  it("keeps the same state object when nothing actually changed", () => {
    useLinkedReportCards.getState().put([pinToCardData(PIN)])
    const before = useLinkedReportCards.getState().cards
    useLinkedReportCards.getState().put([pinToCardData(PIN)])
    expect(useLinkedReportCards.getState().cards).toBe(before)
    useLinkedReportCards.getState().put([])
    expect(useLinkedReportCards.getState().cards).toBe(before)
  })

  it("replaces an entry whose content moved on", () => {
    useLinkedReportCards.getState().put([pinToCardData(PIN)])
    useLinkedReportCards.getState().put([pinToCardData({ ...PIN, status: "resolved" })])
    expect(useLinkedReportCards.getState().cards["r1"]?.status).toBe("resolved")
  })

  it("clears to empty and stays put when already empty", () => {
    useLinkedReportCards.getState().put([pinToCardData(PIN)])
    useLinkedReportCards.getState().clear()
    const empty = useLinkedReportCards.getState().cards
    expect(empty).toEqual({})
    useLinkedReportCards.getState().clear()
    expect(useLinkedReportCards.getState().cards).toBe(empty)
  })
})
