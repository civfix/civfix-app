import React, { useState } from "react"
import { View, Pressable } from "react-native"
import { makeThemedStyles, useTheme, focusRingProps } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { NODE_GLYPH, nodeColor } from "../../primitives/reportTimelineLabels"
import { useT } from "../../i18n"
import type { TimelineNode } from "./timelineModel"

export function TimelineRow({ node, last }: { node: TimelineNode; last: boolean }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-detail")
  const [open, setOpen] = useState(false)
  const color = nodeColor(node.kind, th.scheme)
  return (
    <View style={styles.tlRow}>
      <View style={styles.tlRail}>
        <View style={[styles.tlDot, { backgroundColor: color }]}>
          <Icon icon={iconMap[NODE_GLYPH[node.kind]]} size={13} color={th.colors.onAccent} />
        </View>
        {!last ? <View style={styles.tlLine} /> : null}
      </View>
      <View style={styles.tlBody}>
        <Text style={styles.tlWhen}>{node.when}</Text>
        <View style={styles.tlHeadRow}>
          <Text style={styles.tlHead}>{node.text}</Text>
          {node.pending ? (
            <Pressable
              onPress={() => setOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityLabel={t("timeline.pending_a11y")}
              accessibilityState={{ expanded: open }}
              hitSlop={8}
              {...focusRingProps}
              style={styles.tlInfoBtn}
            >
              <Icon icon={iconMap.Info} size={15} color={th.colors.textSubtle} />
            </Pressable>
          ) : null}
        </View>
        {node.detail ? <Text style={styles.tlDetail}>{node.detail}</Text> : null}
        {node.pending && open ? (
          <Text style={styles.tlNote}>{node.note ?? t("timeline.pending_note")}</Text>
        ) : null}
        {node.body ? (
          <>
            <Pressable
              onPress={() => setOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityLabel={
                open ? t("timeline.hide_full_message_a11y") : t("timeline.show_full_message_a11y")
              }
              accessibilityState={{ expanded: open }}
              hitSlop={6}
              {...focusRingProps}
              style={styles.tlReplyToggle}
            >
              <Icon
                icon={iconMap[open ? "ChevronUp" : "ChevronDown"]}
                size={14}
                color={th.colors.textSubtle}
              />
              <Text style={styles.tlReplyToggleText}>
                {open ? t("timeline.hide_message") : t("timeline.show_full_message")}
              </Text>
            </Pressable>
            {open ? <Text style={styles.tlReplyBody}>{node.body}</Text> : null}
          </>
        ) : null}
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  tlRow: {
    flexDirection: "row",
  },
  tlRail: {
    width: 26,
    alignItems: "center",
  },
  tlDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  tlLine: {
    flex: 1,
    width: 2,
    backgroundColor: t.colors.borderStrong,
    marginVertical: 1,
    minHeight: 28,
  },
  tlBody: {
    flex: 1,
    paddingLeft: t.space["3"],
    paddingBottom: t.space["4"],
  },
  tlWhen: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 11.5,
    color: t.colors.textSubtle,
  },
  tlHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  tlHead: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14.5,
    color: t.colors.text,
  },
  tlDetail: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    lineHeight: 19,
    color: t.colors.textMuted,
    marginTop: 3,
  },
  tlNote: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: t.colors.textSubtle,
    backgroundColor: t.colors.bgAlt,
    borderRadius: t.radius.sm,
    padding: t.space["3"],
    marginTop: 6,
  },
  tlInfoBtn: {
    borderRadius: t.radius.pill,
  },
  tlReplyToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["1"],
    marginTop: 6,
    alignSelf: "flex-start",
  },
  tlReplyToggleText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: t.colors.textSubtle,
  },
  tlReplyBody: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    lineHeight: 19,
    color: t.colors.textMuted,
    backgroundColor: t.colors.bgAlt,
    borderRadius: t.radius.sm,
    padding: t.space["3"],
    marginTop: 6,
  },
}))
