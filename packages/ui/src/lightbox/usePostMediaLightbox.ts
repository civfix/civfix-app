import { useCallback } from "react"
import { toLightboxItems, type LightboxSourceMedia } from "./lightboxItems"
import { useLightbox } from "./MediaLightboxContext"

export function usePostMediaLightbox(media: readonly LightboxSourceMedia[]): (index: number) => void {
  const lightbox = useLightbox()
  return useCallback(
    (index: number) => {
      const items = toLightboxItems(media)
      if (items.length > 0) lightbox.open(items, index)
    },
    [lightbox, media],
  )
}
