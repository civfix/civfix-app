import type React from "react"
import type { StyleProp, ViewStyle } from "react-native"

export interface IosKeyboardAvoidingViewProps {
  style?: StyleProp<ViewStyle>
  enabled?: boolean
  keyboardVerticalOffset?: number
  children?: React.ReactNode
}
