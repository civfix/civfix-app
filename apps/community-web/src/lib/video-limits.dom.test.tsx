import { afterEach, describe, expect, it, vi } from "vitest"

import { readVideoMetadata } from "./video-limits"

const created: HTMLVideoElement[] = []

function captureVideos() {
  const realCreate = document.createElement.bind(document)
  vi.spyOn(document, "createElement").mockImplementation((tag: string, options?: ElementCreationOptions) => {
    const el = realCreate(tag, options)
    if (el instanceof HTMLVideoElement) created.push(el)
    return el
  })
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {})
}

function stub(video: HTMLVideoElement, props: Record<string, number>) {
  for (const [key, value] of Object.entries(props)) Object.defineProperty(video, key, { value })
}

afterEach(() => {
  created.length = 0
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe("readVideoMetadata", () => {
  it("reads the duration and frame size once the header loads, then lets go of the source", async () => {
    captureVideos()
    const pending = readVideoMetadata("blob:clip")
    const video = created[0]!
    expect(video.getAttribute("src")).toBe("blob:clip")
    stub(video, { duration: 11.2, videoWidth: 3840, videoHeight: 2160 })
    video.dispatchEvent(new Event("loadedmetadata"))

    await expect(pending).resolves.toEqual({ durationSec: 11.2, width: 3840, height: 2160 })
    expect(video.hasAttribute("src")).toBe(false)
  })

  it("resolves null when the browser cannot decode the file", async () => {
    captureVideos()
    const pending = readVideoMetadata("blob:hevc")
    created[0]!.dispatchEvent(new Event("error"))

    await expect(pending).resolves.toBeNull()
  })

  it("resolves null when neither event ever fires", async () => {
    vi.useFakeTimers()
    captureVideos()
    const pending = readVideoMetadata("blob:stalled")
    await vi.advanceTimersByTimeAsync(3000)

    await expect(pending).resolves.toBeNull()
  })
})
