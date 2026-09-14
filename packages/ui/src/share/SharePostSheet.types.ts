import type { SharePostTarget } from "./types"

export interface SharePostSheetProps {
  visible: boolean
  target: SharePostTarget
  onClose: () => void
  onClosed?: () => void
}
