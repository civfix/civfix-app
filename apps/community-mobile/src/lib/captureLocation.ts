import type { CapturedMedia } from "@civfix/ui/capabilities"

export type CaptureOrigin = "camera" | "library"

export interface DeviceFix {
  lat: number
  lng: number
}

/**
 * Only a camera capture was taken where the reporter stands now. A library photo or video may be from
 * anywhere, so it never borrows the current fix (that would file an old photo at the reporter's
 * present position, possibly their home) and never triggers a location read or prompt; the report
 * flow then asks for a pin.
 */
export async function locateCapture(
  media: CapturedMedia,
  origin: CaptureOrigin,
  readDeviceFix: () => Promise<DeviceFix | null>,
): Promise<CapturedMedia> {
  if (origin !== "camera") return media
  const fix = await readDeviceFix()
  return fix ? { ...media, location: { lat: fix.lat, lng: fix.lng, source: "device" } } : media
}
