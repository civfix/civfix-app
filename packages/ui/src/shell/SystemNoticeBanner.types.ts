import type { StyleProp, ViewProps, ViewStyle } from "react-native"

export interface SystemNoticeBannerProps {
  /** The host's stacking layer, on web. */
  style?: StyleProp<ViewStyle>
  /** The phone frame measures what the bar takes from the window. */
  onLayout?: ViewProps["onLayout"]
}
