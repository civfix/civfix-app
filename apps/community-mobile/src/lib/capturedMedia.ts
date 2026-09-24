import type { ImagePickerAsset } from "expo-image-picker"
import type { CapturedMedia } from "@civfix/ui/capabilities"

export function fileUri(uri: string): string {
  return uri.startsWith("file://") ? uri : `file://${uri}`
}

export function capturedMediaFromPickerAsset(asset: ImagePickerAsset): CapturedMedia {
  const isVideo = asset.type === "video"
  return {
    uri: asset.uri,
    kind: isVideo ? "video" : "image",
    mime: asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"),
    ...(asset.width ? { width: asset.width } : {}),
    ...(asset.height ? { height: asset.height } : {}),
    ...(isVideo && asset.duration ? { durationSec: asset.duration / 1000 } : {}),
  }
}
