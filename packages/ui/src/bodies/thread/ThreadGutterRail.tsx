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
  const trunk: ViewStyle | null = React.useMemo(() => {
    if (!rail.below) return null
    return { left: railLeft, top: rail.above ? -th.space["3"] : anchor, bottom: -th.space["2"] }
  }, [rail, railLeft, anchor, th])
  const elbow: ViewStyle | null = React.useMemo(() => {
    if (!rail.above || !branch) return null
    const reach = branch === "content" ? geometry.avatarSize + THREAD_RAIL_GAP : 0
    return {
      left: railLeft,
      top: -th.space["3"],
      width: width - railLeft + THREAD_RAIL_GAP + reach,
      height: th.space["3"] + anchor + THREAD_RAIL_W / 2,
    }
  }, [rail.above, branch, geometry.avatarSize, railLeft, width, anchor, th])
  const stub: ViewStyle | null = React.useMemo(() => {
    if (!rail.above || branch || rail.below) return null
    return { left: railLeft, top: -th.space["3"], height: th.space["3"] + anchor }
  }, [rail, branch, railLeft, anchor, th])
  return (
    <View style={[styles.gutter, { width }]}>
      {trunk ? <View style={[styles.line, trunk]} /> : null}
      {stub ? <View style={[styles.line, stub]} /> : null}
      {elbow ? <View style={[styles.elbow, elbow]} /> : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  gutter: {
    marginRight: THREAD_RAIL_GAP,
    alignSelf: "stretch",
  },
  line: {
    position: "absolute",
    width: THREAD_RAIL_W,
    borderRadius: THREAD_RAIL_W / 2,
    backgroundColor: t.colors.borderStrong,
  },
  elbow: {
    position: "absolute",
    borderLeftWidth: THREAD_RAIL_W,
    borderBottomWidth: THREAD_RAIL_W,
    borderBottomLeftRadius: t.radius.sm,
    borderColor: t.colors.borderStrong,
  },
}))
