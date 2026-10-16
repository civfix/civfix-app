import { MAX_VIDEO_SECONDS } from "@civfix/contract"
import type { CapturedMedia } from "@civfix/ui/capabilities"

/**
 * Whether a picked or recorded video is longer than the worker accepts. Only the length: the app
 * compresses every video to a 1280 long edge before upload, so its original size never reaches the
 * worker. An unknown length counts as within the limit, as on web; the worker enforces it regardless.
 */
export function overVideoDuration(media: CapturedMedia): boolean {
  if (media.kind !== "video" || media.durationSec === undefined) return false
  // Rounded like the worker's cap, which publishes a 10 s camera clip that reads a few hundredths over.
  return Number.isFinite(media.durationSec) && Math.round(media.durationSec) > MAX_VIDEO_SECONDS
}
