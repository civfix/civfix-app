import { useEffect, useState } from "react"
import { Keyboard } from "react-native"
import { KEYBOARD_HIDE_EVENT, KEYBOARD_SHOW_EVENT } from "./keyboardPlatform"

export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const showSub = Keyboard.addListener(KEYBOARD_SHOW_EVENT, () => setVisible(true))
    const hideSub = Keyboard.addListener(KEYBOARD_HIDE_EVENT, () => setVisible(false))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])
  return visible
}
