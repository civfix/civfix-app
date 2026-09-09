/**
 * useKeyboardVisible - true while the software keyboard is shown.
 *
 * A pure react-native Keyboard-listener hook (no gorhom, no shell coupling), ported verbatim from the
 * pre-unification mobile app's `src/hooks/useKeyboardVisible.ts`. It lives in @civfix/ui/shell because its
 * one consumer is the full-screen ConversationBody (issue C): the shell's gorhom sheet keeps the in-sheet
 * composer above the keyboard, but a full SCREEN has no sheet, so the body drives its own
 * KeyboardAvoidingView + composer bottom-inset off this flag.
 *
 * iOS uses the `will*` events so the value flips IN SYNC with the KeyboardAvoidingView animation; Android
 * has no `will*` events, so it uses `did*`.
 */
import { useEffect, useState } from "react"
import { Keyboard, Platform } from "react-native"

export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"
    const showSub = Keyboard.addListener(showEvent, () => setVisible(true))
    const hideSub = Keyboard.addListener(hideEvent, () => setVisible(false))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])
  return visible
}
