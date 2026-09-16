import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import type { AnnouncementDTO } from "@civfix/shared"
import { focusRingProps, makeThemedStyles, useTheme, webCursor, webHover, webTransition } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { Avatar } from "../../primitives"
import { useRelativeTime, useT } from "../../i18n"
import {
  ANNOUNCEMENT_PREVIEW_LINES,
  announcementCounts,
  announcementHeading,
  announcementPreview,
  announcementSentAt,
} from "./announcementModel"

const AVATAR_SIZE = 24

export interface AnnouncementCardProps {
  announcement: AnnouncementDTO
  /** Host surfaces show the audience chip and the delivery counts; public readers never do. */
  showDelivery?: boolean
  onPress?: () => void
}

export function AnnouncementCard({
  announcement,
  showDelivery = false,
  onPress,
}: AnnouncementCardProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-broadcasts")
  const { t: tEnums } = useT("enums")
  const { relative } = useRelativeTime()

  const heading = announcementHeading(announcement)
  const preview = announcementPreview(announcement.bodyMd)
  const counts = showDelivery ? announcementCounts(announcement) : null
  const audience = showDelivery ? announcement.audience : null
  const org = announcement.authorOrg ?? null
  const author = announcement.author ?? null
  const byline = org?.name ?? author?.name ?? t("announce.byline_host")
  const when = relative(announcementSentAt(announcement))

  const body = (
    <View style={styles.card}>
      <View style={styles.byline}>
        <Avatar
          name={byline}
          seed={org?.id ?? author?.id ?? announcement.id}
          photoUrl={org?.logoUrl ?? author?.avatarUrl ?? null}
          gradient={org ? null : (author?.avatar ?? null)}
          size={AVATAR_SIZE}
          decorative
        />
        <Text variant="caption" numberOfLines={1} style={styles.bylineText}>
          {t("announce.byline", { name: byline, when })}
        </Text>
      </View>

      {heading ? (
        <Text style={styles.title} numberOfLines={2}>
          {heading}
        </Text>
      ) : null}

      {preview.length > 0 ? (
        <Text variant="caption" numberOfLines={ANNOUNCEMENT_PREVIEW_LINES} style={styles.preview}>
          {preview}
        </Text>
      ) : null}

      {audience || counts ? (
        <View style={styles.meta}>
          {audience ? (
            <View style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>
                {tEnums(`broadcastSegment.${audience.kind}`)}
              </Text>
            </View>
          ) : null}
          {counts ? (
            <Text variant="caption" numberOfLines={1}>
              {t("announce.notified", { sent: counts.sent, total: counts.recipients })}
            </Text>
          ) : null}
          {counts && counts.failed > 0 ? (
            <View style={styles.failedChip}>
              <Icon icon={iconMap.TriangleAlert} size={12} color={th.colors.dangerInk} />
              <Text style={styles.failedText}>
                {t("announce.failed", { failed: counts.failed })}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )

  if (!onPress) return body

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={heading ?? preview}
      {...focusRingProps}
      style={(state) => [
        styles.press,
        webTransition,
        webCursor(),
        webHover(state) ? styles.pressHovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      {body}
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  press: {
    borderRadius: t.radius.lg,
  },
  pressHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  pressed: {
    opacity: 0.9,
  },
  card: {
    gap: t.space["1"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  byline: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  bylineText: {
    flexShrink: 1,
  },
  title: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  preview: {
    color: t.colors.textMuted,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: t.space["2"],
    marginTop: t.space["1"],
  },
  chip: {
    paddingHorizontal: t.space["2"],
    paddingVertical: 2,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
  },
  chipText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
  },
  failedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  failedText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.dangerInk,
  },
}))
