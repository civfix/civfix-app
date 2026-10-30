import { useSafeAreaInsets } from "react-native-safe-area-context"
import { space } from "../theme"
import { SystemNoticeBar, useVisibleSystemNotice } from "./SystemNoticeBanner.shared"
import type { SystemNoticeBannerProps } from "./SystemNoticeBanner.types"

const CONTENT_TOP = { paddingTop: space["1"] }

/**
 * In the root's layout flow, under the status bar: it pads for the status bar itself, and SystemNoticeFrame
 * gives the screens below it a top inset of 0. It publishes no height; nothing on the phone overlays it.
 */
export function SystemNoticeBanner({ style, onLayout }: SystemNoticeBannerProps) {
  const notice = useVisibleSystemNotice()
  const insets = useSafeAreaInsets()
  if (!notice) return null
  return (
    <SystemNoticeBar
      notice={notice}
      style={[{ paddingTop: insets.top }, style]}
      contentStyle={CONTENT_TOP}
      onLayout={onLayout}
    />
  )
}
