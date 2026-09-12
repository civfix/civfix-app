import React from "react"
import { StyleSheet, View } from "react-native"
import { makeThemedStyles } from "../../theme"
import { ThreadGutterRail } from "./ThreadGutterRail"
import {
  THREAD_AVATAR_SIZE,
  THREAD_NESTED_AVATAR_SIZE,
  THREAD_RAIL_GAP,
  THREAD_RAIL_W,
  threadRowGeometry,
  type ThreadRailSegment,
  type ThreadRowDepth,
} from "./threadModel"

export interface ThreadChainRowProps {
  /** The rail this row draws, straight off `buildThreadRows`. */
  rail: ThreadRailSegment
  depth?: ThreadRowDepth
  /** Draw the bottom separator. False while this row is chained to the row below it. */
  hairline?: boolean
  /** The row's content, aligned to the same text column the reply rows use. */
  children: React.ReactNode
}

export function ThreadChainRow({ rail, depth = 1, hairline = true, children }: ThreadChainRowProps) {
  const styles = useStyles()
  const geometry = threadRowGeometry(depth)
  const nested = geometry.indent > 0
  return (
    <View style={hairline ? styles.outerRule : null}>
      <View style={styles.row}>
        {nested ? <ThreadGutterRail rail={rail} geometry={geometry} branch="content" /> : null}
        <View style={nested ? styles.railColumnNested : styles.railColumn}>
          {!nested && rail.above ? (
            <View style={[styles.rail, rail.below ? styles.railThrough : null]} />
          ) : null}
        </View>
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
  railColumn: {
    width: THREAD_AVATAR_SIZE,
    alignItems: "center",
  },
  railColumnNested: {
    width: THREAD_NESTED_AVATAR_SIZE,
    alignItems: "center",
  },
  rail: {
    width: THREAD_RAIL_W,
    flex: 1,
    marginTop: -t.space["3"],
    borderRadius: THREAD_RAIL_W / 2,
    backgroundColor: t.colors.border,
  },
  railThrough: {
    marginBottom: -t.space["2"],
  },
  content: {
    flex: 1,
    minWidth: 0,
    marginLeft: THREAD_RAIL_GAP,
  },
}))
