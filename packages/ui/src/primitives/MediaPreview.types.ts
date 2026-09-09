import type { StyleProp, ViewStyle } from "react-native"

export interface MediaPreviewProps {
  uri: string
  kind: "image" | "video"
  posterUri?: string | null
  thumbUri?: string | null
  aspectRatio?: number
  autoplay?: boolean
  alt?: string | null
  framed?: boolean
  style?: StyleProp<ViewStyle>
}

export const DEFAULT_ASPECT_RATIO = 4 / 3
