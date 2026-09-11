import React, { forwardRef } from "react"
import { TextInput as RNTextInput } from "react-native"
import type { TextInputProps } from "./TextInput.types"

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(props, ref) {
  return <RNTextInput {...props} ref={ref} />
})
