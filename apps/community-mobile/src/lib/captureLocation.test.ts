import { test } from "node:test"
import assert from "node:assert/strict"
import type { CapturedMedia } from "@civfix/ui/capabilities"
import { locateCapture, type DeviceFix } from "./captureLocation.ts"

const photo: CapturedMedia = { uri: "file:///tmp/p.jpg", kind: "image", mime: "image/jpeg", width: 4, height: 3 }
const video: CapturedMedia = { uri: "file:///tmp/v.mp4", kind: "video", mime: "video/mp4", durationSec: 9 }

function fixReader(fix: DeviceFix | null) {
  const reader = { calls: 0, read: async () => {
    reader.calls += 1
    return fix
  } }
  return reader
}

test("a camera capture carries the shutter fix as a device location", async () => {
  const reader = fixReader({ lat: 34.05, lng: -118.25 })
  assert.deepEqual(await locateCapture(photo, "camera", reader.read), {
    ...photo,
    location: { lat: 34.05, lng: -118.25, source: "device" },
  })
  assert.equal(reader.calls, 1)
})

test("a camera capture without a readable fix goes on with no location", async () => {
  const reader = fixReader(null)
  assert.deepEqual(await locateCapture(photo, "camera", reader.read), photo)
})

test("a library photo or video never borrows the reporter's current position", async () => {
  for (const media of [photo, video]) {
    const reader = fixReader({ lat: 34.05, lng: -118.25 })
    const located = await locateCapture(media, "library", reader.read)
    assert.equal(located.location, undefined, `${media.kind} picked from the library carried a device fix`)
    assert.deepEqual(located, media)
    assert.equal(reader.calls, 0, "a library pick must not read (or prompt for) the device location")
  }
})
