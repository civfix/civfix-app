import assert from "node:assert/strict"
import { test } from "node:test"
import { dropPinMenuAlreadyOpen, dropPinRestoreFlyArgs } from "./dropPinRestore.ts"

test("dropPinRestoreFlyArgs transposes to THIS SCREEN'S flyTo(lng, lat, zoom)", () => {
  // The shared package speaks {lat, lng, zoom}. The screen-local flyTo (app/index.tsx:267-279) takes LNG
  // FIRST; MapHandle.flyTo (@civfix/ui map/types.ts:140), which app/index.tsx:243 calls inside
  // replayPendingMapTarget, takes LAT first. Getting this backwards flies to a valid-but-wrong coordinate
  // with no error at all - which is why it is tested.
  assert.deepEqual(dropPinRestoreFlyArgs({ lat: 34.05, lng: -118.25, zoom: 12.5 }), [
    -118.25,
    34.05,
    12.5,
  ])
})

test("dropPinRestoreFlyArgs is not symmetric - a transposed impl fails this", () => {
  const [lng, lat] = dropPinRestoreFlyArgs({ lat: 10, lng: 20, zoom: 17 })
  assert.equal(lng, 20)
  assert.equal(lat, 10)
  assert.notEqual(lng, lat)
})

test("dropPinMenuAlreadyOpen reads the guard a SECOND long press needs", () => {
  // "drop-pin" is not a FLOW_KIND, so a second long press while the menu is open is ACCEPTED and
  // openDetail simply replaces the entry. The host must read this BEFORE openDropPinMenu (afterwards
  // there is always a drop-pin entry) so captureDropPinCamera keeps the FIRST pre-press camera.
  assert.equal(dropPinMenuAlreadyOpen([]), false)
  assert.equal(dropPinMenuAlreadyOpen([{ kind: "cleanup" }]), false)
  assert.equal(dropPinMenuAlreadyOpen([{ kind: "drop-pin" }]), true)
  // Expanded APPENDS, so the entry is not always at index 0.
  assert.equal(dropPinMenuAlreadyOpen([{ kind: "cleanups" }, { kind: "drop-pin" }]), true)
  // And it is still "open" while a host form is drilled in on top of it.
  assert.equal(dropPinMenuAlreadyOpen([{ kind: "drop-pin" }, { kind: "create-cleanup" }]), true)
})
