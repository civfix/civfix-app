import React from "react"
import { View, type ViewStyle } from "react-native"
import { makeThemedStyles, useTheme } from "../../theme"
import {
  THREAD_RAIL_GAP,
  THREAD_RAIL_W,
  threadGutterWidth,
  type ThreadRailSegment,
  type ThreadRowGeometry,
} from "./threadModel"

export interface ThreadGutterRailProps {
  rail: ThreadRailSegment
  geometry: ThreadRowGeometry
  branch?: "avatar" | "content"
  anchor?: number
}

export function ThreadGutterRail({
  rail,
  geometry,
  branch,
  anchor = geometry.avatarSize / 2,
}: ThreadGutterRailProps) {
  const styles = useStyles()
  const th = useTheme()
  const width = threadGutterWidth(geometry)
  const railLeft = (width - THREAD_RAIL_W) / 2
  const segment: ViewStyle | null = React.useMemo(() => {
    if (rail.above && rail.below) return { left: railLeft, top: -th.space["3"], bottom: -th.space["2"] }
    if (rail.above) return { left: railLeft, top: -th.space["3"], height: th.space["3"] + anchor }
    if (rail.below) return { left: railLeft, top: anchor, bottom: -th.space["2"] }
    return null
  }, [rail, railLeft, anchor, th])
  const branchStyle: ViewStyle | null = React.useMemo(
    () =>
      branch && segment
        ? {
            left: railLeft,
            top: anchor - THREAD_RAIL_W / 2,
            width:
              width
              - railLeft
              + THREAD_RAIL_GAP
              + (branch === "content" ? geometry.avatarSize + THREAD_RAIL_GAP : 0),
          }
        : null,
    [branch, segment, railLeft, anchor, width, geometry.avatarSize],
  )
  return (
    <View style={[styles.gutter, { width }]}>
      {segment ? <View style={[styles.rail, segment]} /> : null}
      {branchStyle ? <View style={[styles.branch, branchStyle]} /> : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  gutter: {
    marginRight: THREAD_RAIL_GAP,
    alignSelf: "stretch",
  },
  rail: {
    position: "absolute",
    width: THREAD_RAIL_W,
    borderRadius: THREAD_RAIL_W / 2,
    backgroundColor: t.colors.border,
  },
  branch: {
    position: "absolute",
    height: THREAD_RAIL_W,
    borderRadius: THREAD_RAIL_W / 2,
    backgroundColor: t.colors.border,
  },
}))
