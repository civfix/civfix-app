import React from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { PortraitShellFrame, type PortraitShellProps } from "./PortraitShell.shared"
import { initialTabBarFootprint } from "./tabBarLogic"

export function PortraitShell(props: PortraitShellProps) {
  const insets = useSafeAreaInsets()
  return (
    <PortraitShellFrame
      {...props}
      topInset={insets.top}
      bottomChromeFallback={initialTabBarFootprint("native", insets.bottom)}
      // The overlay layer's fallback bottom reserve: a full detail page hides the dock, so nothing else
      // keeps its last row clear of the home indicator / Android nav bar.
      bottomSafeArea={insets.bottom}
      keyboardInset={0}
    />
  )
}
