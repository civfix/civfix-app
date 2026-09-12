import React from "react"
import { KeyboardAvoidingView, Platform } from "react-native"
import type { IosKeyboardAvoidingViewProps } from "./IosKeyboardAvoidingView.types"

export function IosKeyboardAvoidingView({
  style,
  enabled = true,
  keyboardVerticalOffset,
  children,
}: IosKeyboardAvoidingViewProps) {
  return (
    <KeyboardAvoidingView
      style={style}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      enabled={enabled}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  )
}
