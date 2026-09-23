import React, { useContext } from "react"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import { useAppPromoStore } from "../promo/appPromoStore"
import { PortraitShellFrame, type PortraitShellProps } from "./PortraitShell.shared"
import { initialTabBarFootprint } from "./tabBarLogic"
import { useKeyboardInset } from "./useKeyboardInset.web"

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 }

export function PortraitShell(props: PortraitShellProps) {
  const keyboardInset = useKeyboardInset()
  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS
  const bannerHeight = useAppPromoStore((state) => state.bannerHeight)
  return (
    <PortraitShellFrame
      {...props}
      topInset={Math.max(insets.top, bannerHeight)}
      bottomChromeFallback={initialTabBarFootprint("web")}
      bottomSafeArea={insets.bottom}
      keyboardInset={keyboardInset}
    />
  )
}
