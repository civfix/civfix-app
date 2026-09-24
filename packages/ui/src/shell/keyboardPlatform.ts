import { Platform } from "react-native"

export const KEYBOARD_PLATFORM: "ios" | "android" | "other" =
  Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "other"

// iOS uses the `will*` events so a change lands in sync with the keyboard animation; Android has no
// `will*` events, so it uses `did*`.
export const KEYBOARD_SHOW_EVENT = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
export const KEYBOARD_HIDE_EVENT = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"
