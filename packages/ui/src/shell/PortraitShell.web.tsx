import React from "react"
import { PortraitShellFrame, type PortraitShellProps } from "./PortraitShell.shared"
import { initialTabBarFootprint } from "./tabBarLogic"
import { useKeyboardInset } from "./useKeyboardInset.web"

export function PortraitShell(props: PortraitShellProps) {
  const keyboardInset = useKeyboardInset()
  return (
    <PortraitShellFrame
      {...props}
      topInset={0}
      bottomChromeFallback={initialTabBarFootprint("web")}
      // No home indicator to clear in a browser, and details stay SHEETS here anyway - 0 keeps the web
      // overlay's paddingBottom exactly `frame.overlay.bottomInset`, i.e. byte-identical.
      bottomSafeArea={0}
      keyboardInset={keyboardInset}
    />
  )
}
