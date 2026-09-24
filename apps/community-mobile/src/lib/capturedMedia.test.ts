import assert from "node:assert/strict"
import { test } from "node:test"
import type { ImagePickerAsset } from "expo-image-picker"
import { capturedMediaFromPickerAsset, fileUri } from "./capturedMedia.ts"

function asset(overrides: Partial<ImagePickerAsset>): ImagePickerAsset {
  return { uri: "file:///picked.jpg", width: 0, height: 0, ...overrides }
}

test("a bare path gains the file scheme, and a file URI is left alone", () => {
  assert.equal(fileUri("/tmp/photo.jpg"), "file:///tmp/photo.jpg")
  assert.equal(fileUri("file:///tmp/photo.jpg"), "file:///tmp/photo.jpg")
})

test("a picked image keeps its own mime and dimensions", () => {
  assert.deepEqual(
    capturedMediaFromPickerAsset(asset({ type: "image", mimeType: "image/png", width: 640, height: 480 })),
    { uri: "file:///picked.jpg", kind: "image", mime: "image/png", width: 640, height: 480 },
  )
})

test("a picked video reports its duration in seconds and falls back to mp4", () => {
  assert.deepEqual(
    capturedMediaFromPickerAsset(asset({ uri: "file:///clip.mov", type: "video", duration: 4500 })),
    { uri: "file:///clip.mov", kind: "video", mime: "video/mp4", durationSec: 4.5 },
  )
})

test("an untyped pick is an image, and zero dimensions are omitted", () => {
  assert.deepEqual(capturedMediaFromPickerAsset(asset({})), {
    uri: "file:///picked.jpg",
    kind: "image",
    mime: "image/jpeg",
  })
})
