import React from "react"
import { StyleSheet, View } from "react-native"
import { makeThemedStyles } from "../../theme"
import { ThreadGutterRail } from "./ThreadGutterRail"
import {
  THREAD_CHAIN_ROW_MIN_H,
  THREAD_MAX_INLINE_DEPTH,
  THREAD_NESTED_AVATAR_SIZE,
  THREAD_RAIL_GAP,
  threadRowGeometry,
  type ThreadRailSegment,
} from "./threadModel"

export interface ThreadChainRowProps {
  rail: ThreadRailSegment
  hairline?: boolean
  children: React.ReactNode
}

const NESTED_GEOMETRY = threadRowGeometry(THREAD_MAX_INLINE_DEPTH)

export function ThreadChainRow({ rail, hairline = true, children }: ThreadChainRowProps) {
  const styles = useStyles()
  return (
    <View style={hairline ? styles.outerRule : null}>
      <View style={styles.row}>
        <ThreadGutterRail
          rail={rail}
          geometry={NESTED_GEOMETRY}
          branch="content"
          anchor={THREAD_CHAIN_ROW_MIN_H / 2}
        />
        <View style={styles.avatarColumn} />
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  outerRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["3"],
    paddingBottom: t.space["2"],
  },
  avatarColumn: {
    width: THREAD_NESTED_AVATAR_SIZE,
  },
  content: {
    flex: 1,
    minWidth: 0,
    marginLeft: THREAD_RAIL_GAP,
  },
}))
