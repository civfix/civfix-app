import { MAX_VIDEO_LONG_EDGE, MAX_VIDEO_SECONDS } from "@civfix/shared"

export interface VideoMetadata {
  durationSec: number
  width: number
  height: number
}

// Metadata of a local blob loads in milliseconds. The bound is there because an engine that defers
// loading (a power-saving mode) may never fire either event, and the check must not hold up a pick.
const METADATA_TIMEOUT_MS = 3000

/**
 * Whether the video is over the worker's limits. A value the browser could not read (a non-finite
 * duration, a 0x0 frame from a codec it cannot decode) counts as within them: the worker enforces the
 * limits anyway, and this check only spares the user a failed upload.
 */
export function overVideoLimits(meta: VideoMetadata): boolean {
  const tooLong = Number.isFinite(meta.durationSec) && meta.durationSec > MAX_VIDEO_SECONDS
  return tooLong || Math.max(meta.width, meta.height) > MAX_VIDEO_LONG_EDGE
}

/** The duration and frame size the browser reads from a video's header, or null when it cannot. */
export function readVideoMetadata(src: string): Promise<VideoMetadata | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video")
    let settled = false
    const finish = (meta: VideoMetadata | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      video.removeAttribute("src")
      video.load()
      resolve(meta)
    }
    const timer = setTimeout(() => finish(null), METADATA_TIMEOUT_MS)
    video.addEventListener("loadedmetadata", () =>
      finish({ durationSec: video.duration, width: video.videoWidth, height: video.videoHeight }),
    )
    video.addEventListener("error", () => finish(null))
    video.preload = "metadata"
    video.muted = true
    video.src = src
  })
}
