/**
 * ThreadChainRow - the two rows of an expanded reply chain that are not posts: the "show more" cursor at
 * the end of the chain, and the placeholder while a child page is in flight.
 *
 * It exists so those rows sit INSIDE the threadline rather than breaking it. There is exactly one rail
 * system in this surface: the gutter geometry comes from `threadModel` (the same constants
 * `ThreadReplyRow` uses), the caller passes the same `ThreadRailSegment` `buildThreadRows` produced, and
 * the same rule applies - a row chained to the row below draws NO bottom hairline, because the threadline
 * is the separator.
 *
 * Unlike a reply row there is no avatar splitting the column, so the rail is ONE continuous segment
 * instead of the reply row's above-stub / below-tail pair.
 */
import React from "react"
import { StyleSheet, View } from "react-native"
import { makeThemedStyles } from "../../theme"
import {
  THREAD_RAIL_COLUMN_W,
  THREAD_RAIL_GAP,
  THREAD_RAIL_W,
  type ThreadRailSegment,
} from "./threadModel"

export interface ThreadChainRowProps {
  /** The rail this row draws, straight off `buildThreadRows`. */
  rail: ThreadRailSegment
  /** Draw the bottom separator. False while this row is chained to the row below it. */
  hairline?: boolean
  /** The row's content, aligned to the same text column the reply rows use. */
  children: React.ReactNode
}

export function ThreadChainRow({ rail, hairline = true, children }: ThreadChainRowProps) {
  const styles = useStyles()
  return (
    <View style={hairline ? styles.outerRule : null}>
      <View style={styles.row}>
        <View style={styles.railColumn}>
          {rail.above ? (
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
    width: THREAD_RAIL_COLUMN_W,
    alignItems: "center",
  },
  // The negative margin cancels the row's own paddingTop so the segment starts at the row's TRUE top
  // edge, where the row above ended - derived from the same token the padding uses, never a literal.
  rail: {
    width: THREAD_RAIL_W,
    flex: 1,
    marginTop: -t.space["3"],
    borderRadius: THREAD_RAIL_W / 2,
    backgroundColor: t.colors.border,
  },
  // Only a row that continues DOWN pushes through its own bottom padding to meet the next row's rail.
  railThrough: {
    marginBottom: -t.space["2"],
  },
  content: {
    flex: 1,
    minWidth: 0,
    marginLeft: THREAD_RAIL_GAP,
  },
}))
