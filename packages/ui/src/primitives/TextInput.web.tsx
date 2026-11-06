import {
  forwardRef,
  type ForwardRefExoticComponent,
  type PropsWithoutRef,
  type RefAttributes,
} from "react"
import { TextInput as RNTextInput, type TextInputInstance } from "react-native"
import type { TextInputProps } from "./TextInput.types"

export const TextInput: ForwardRefExoticComponent<
  PropsWithoutRef<TextInputProps> & RefAttributes<TextInputInstance>
> = forwardRef<TextInputInstance, TextInputProps>(function TextInput(props, ref) {
  return <RNTextInput {...props} ref={ref} />
})
