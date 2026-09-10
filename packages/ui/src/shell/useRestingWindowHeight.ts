import { useEffect, useRef, type RefObject } from "react"
import { Dimensions, Keyboard } from "react-native"
import { shouldRecaptureRestingHeight } from "./keyboardInsetModel"

export function useRestingWindowHeight(): RefObject<number> {
  const restingWindowHeight = useRef(Dimensions.get("window").height)
  const restingWindowWidth = useRef(Dimensions.get("window").width)
  const keyboardOpen = useRef(false)

  useEffect(() => {
    const keyboardIsUp = () => keyboardOpen.current || Keyboard.isVisible()
    const capture = ({ width, height }: { width: number; height: number }) => {
      restingWindowWidth.current = width
      restingWindowHeight.current = height
    }
    const subs = [
      Keyboard.addListener("keyboardDidShow", () => {
        keyboardOpen.current = true
      }),
      Keyboard.addListener("keyboardDidHide", () => {
        keyboardOpen.current = false
        capture(Dimensions.get("window"))
      }),
      Dimensions.addEventListener("change", ({ window }) => {
        if (
          !shouldRecaptureRestingHeight({
            keyboardOpen: keyboardIsUp(),
            prevWidth: restingWindowWidth.current,
            nextWidth: window.width,
          })
        ) {
          return
        }
        capture(window)
      }),
    ]
    return () => subs.forEach((sub) => sub.remove())
  }, [])

  return restingWindowHeight
}
