import type React from "react"
import type { View } from "react-native"
import type { PostActionMenuRect } from "./postActionModel"

export interface PostActionMenuProps {
  visible: boolean
  reposted: boolean
  anchorRect: PostActionMenuRect | null
  reducedMotion: boolean
  returnFocusRef: React.RefObject<View | null>
  onDismiss: () => void
  onRepost: () => void
  onQuote: () => void
}
