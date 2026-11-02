import type { StyleProp, ViewStyle } from "react-native"

export interface MediaPreviewProps {
  uri: string
  kind: "image" | "video"
  posterUri?: string | null | undefined
  thumbUri?: string | null | undefined
  aspectRatio?: number
  alt?: string | null | undefined
  framed?: boolean
  style?: StyleProp<ViewStyle>
}

export const DEFAULT_ASPECT_RATIO = 4 / 3
