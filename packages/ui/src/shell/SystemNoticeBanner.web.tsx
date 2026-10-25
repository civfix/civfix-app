import React, { useLayoutEffect, useRef } from "react"
import type { View, ViewStyle } from "react-native"
import { space } from "../theme"
import { SystemNoticeBar, useVisibleSystemNotice } from "./SystemNoticeBanner.shared"
import type { SystemNoticeBannerProps } from "./SystemNoticeBanner.types"
import { useSystemNoticeStore } from "./systemNoticeStore"

// Safe-area padding is a no-op in a normal Safari tab (its viewport already starts below the status bar)
// but keeps the text clear of the notch in edge-to-edge browser chrome. As the topmost bar the notice owns
// the inset; the download banner under it drops its own.
const FIXED_TOP = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  paddingTop: `calc(${space["1"]}px + env(safe-area-inset-top, 0px))`,
  paddingRight: "env(safe-area-inset-right, 0px)",
  paddingLeft: "env(safe-area-inset-left, 0px)",
} as unknown as ViewStyle

/**
 * Fixed above the whole web app at every width. It overlays the shell, so everything under it makes room
 * through the height it publishes: the download banner, the map controls, the portrait sheet and the wide
 * layout's rail and panel. The height is measured rather than fixed because the text wraps.
 */
export function SystemNoticeBanner({ style, onLayout }: SystemNoticeBannerProps) {
  const notice = useVisibleSystemNotice()
  const setHeight = useSystemNoticeStore((s) => s.setHeight)
  const ref = useRef<View>(null)
  const visible = notice !== null

  // A layout effect runs before paint, so nothing is painted under the bar for a frame.
  useLayoutEffect(() => {
    // react-native-web's host ref is the DOM node.
    const el = ref.current as unknown as HTMLElement | null
    if (!visible || !el) {
      setHeight(0)
      return
    }
    const publish = () => setHeight(el.getBoundingClientRect().height)
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => {
      observer.disconnect()
      setHeight(0)
    }
  }, [visible, setHeight])

  if (!notice) return null
  return <SystemNoticeBar ref={ref} notice={notice} style={[FIXED_TOP, style]} onLayout={onLayout} />
}
