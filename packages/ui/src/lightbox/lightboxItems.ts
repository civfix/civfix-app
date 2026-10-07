import type { MediaDTO } from "@civfix/shared"
import type { LightboxItem } from "./MediaLightbox.types"

export type LightboxSourceMedia = Pick<MediaDTO, "url" | "kind" | "thumbUrl" | "width" | "height">

export function toLightboxItems(media: readonly LightboxSourceMedia[]): LightboxItem[] {
  return media.map((item) => ({
    url: item.url,
    kind: item.kind === "video" ? "video" : "image",
    thumbUrl: item.thumbUrl ?? null,
    width: item.width ?? null,
    height: item.height ?? null,
  }))
}
