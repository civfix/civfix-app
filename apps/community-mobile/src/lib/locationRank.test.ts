import { test } from "node:test"
import assert from "node:assert/strict"
import { mergeResolvedLocation, type ResolvedLocation } from "./locationRank.ts"

const GPS: ResolvedLocation = { lat: 34.05, lng: -118.24, precise: true }
const GPS_MOVED: ResolvedLocation = { lat: 34.06, lng: -118.25, precise: true }
const IP: ResolvedLocation = { lat: 34.0, lng: -118.0, precise: false }
const IP_OTHER: ResolvedLocation = { lat: 33.9, lng: -117.9, precise: false }

test("a late IP answer never overwrites a precise fix", () => {
  assert.equal(mergeResolvedLocation(GPS, IP), GPS)
  assert.equal(mergeResolvedLocation(GPS, IP_OTHER), GPS)
})

test("a precise fix upgrades an approximate one", () => {
  assert.equal(mergeResolvedLocation(IP, GPS), GPS)
})

test("a precise fix always replaces an earlier precise fix", () => {
  assert.equal(mergeResolvedLocation(GPS, GPS_MOVED), GPS_MOVED)
})

test("an approximate answer replaces an earlier approximate one", () => {
  assert.equal(mergeResolvedLocation(IP, IP_OTHER), IP_OTHER)
})

test("the first answer of either precision wins over nothing", () => {
  assert.equal(mergeResolvedLocation(null, IP), IP)
  assert.equal(mergeResolvedLocation(null, GPS), GPS)
})

test("a failed lookup keeps whatever is already known", () => {
  assert.equal(mergeResolvedLocation(GPS, null), GPS)
  assert.equal(mergeResolvedLocation(IP, null), IP)
  assert.equal(mergeResolvedLocation(null, null), null)
})
