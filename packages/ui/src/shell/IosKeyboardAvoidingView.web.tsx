import React from "react"
import { View } from "react-native"
import type { IosKeyboardAvoidingViewProps } from "./IosKeyboardAvoidingView.types"

export function IosKeyboardAvoidingView({ style, children }: IosKeyboardAvoidingViewProps) {
  return <View style={style}>{children}</View>
}
