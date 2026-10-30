import { test } from "node:test"
import assert from "node:assert/strict"
import { overVideoDuration } from "./videoLimits.ts"

const video = (durationSec?: number) => ({
  uri: "file:///clip.mp4",
  kind: "video" as const,
  mime: "video/mp4",
  ...(durationSec === undefined ? {} : { durationSec }),
})

test("a video that rounds to 10 s or less passes", () => {
  assert.equal(overVideoDuration(video(9)), false)
  assert.equal(overVideoDuration(video(10.03)), false)
  assert.equal(overVideoDuration(video(10.4)), false)
})

test("a video that rounds past 10 s is refused", () => {
  assert.equal(overVideoDuration(video(10.5)), true)
  assert.equal(overVideoDuration(video(15)), true)
})

test("a video of unknown length passes", () => {
  assert.equal(overVideoDuration(video()), false)
  assert.equal(overVideoDuration(video(Number.NaN)), false)
})

test("a photo always passes", () => {
  assert.equal(
    overVideoDuration({
      uri: "file:///shot.jpg",
      kind: "image",
      mime: "image/jpeg",
      durationSec: 60,
    }),
    false,
  )
})
