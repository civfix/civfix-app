
export interface LightboxItem {
  url: string
  kind: "image" | "video"
  thumbUrl?: string | null
  width?: number | null
  height?: number | null
}

export interface MediaLightboxContextValue {
  open: (items: LightboxItem[], startIndex?: number) => void
  close: () => void
}
