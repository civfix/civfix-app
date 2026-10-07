import React from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { CleanupDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, focusRingProps, webCursor, webHover, webTransition } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT, useEventWhen } from "../i18n"
import { Avatar } from "./Avatar"
import { DateBadge } from "./DateBadge"
import { OrgAffiliationBadge } from "./OrgAffiliationBadge"

export function EventCard({ cleanup, onPress }: { cleanup: CleanupDTO; onPress: () => void }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-card")
  const when = useEventWhen(cleanup)
  const where = cleanup.address?.trim()
  const affiliation = cleanup.organization ?? cleanup.organizer.organization
  const a11yLabel = t("a11y.card_detail", {
    title: cleanup.title,
    when: when.time === "" ? t("linked.schedule_unavailable") : `${when.dow}, ${when.date}, ${when.timeWithZone}`,
    location: where || t("linked.location_fallback"),
    going: t("going", { count: cleanup.going }),
    organizer: `${t("organizer.by_prefix")} ${cleanup.organizer.name}`,
  })
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      {...focusRingProps}
      style={(state) => [
        styles.card,
        webCursor(),
        webTransition,
        webHover(state) ? styles.cardHovered : null,
        state.pressed ? styles.cardPressed : null,
      ]}
    >
      <DateBadge iso={cleanup.scheduledAt} timeZone={when.timeZone} />

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="heading" numberOfLines={1} style={styles.title}>
            {cleanup.title}
          </Text>
          {cleanup.joined ? (
            <View style={styles.joinedTag}>
              <Text variant="caption" color={th.colors.moss["700"]} style={styles.joinedTagText}>
                {t("joined_tag")}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Icon icon={iconMap.Clock} size={13} color={th.colors.textSubtle} />
            <Text variant="caption" color={th.colors.textMuted}>
              {when.timeWithZone}
            </Text>
          </View>
          {where ? (
            <View style={[styles.metaItem, styles.metaItemGrow]}>
              <Icon icon={iconMap.MapPin} size={13} color={th.colors.textSubtle} />
              <Text variant="caption" color={th.colors.textMuted} numberOfLines={1}>
                {where}
              </Text>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <Icon icon={iconMap.Users} size={13} color={th.colors.textSubtle} />
            <Text variant="caption" color={th.colors.textMuted}>
              {t("going", { count: cleanup.going })}
            </Text>
          </View>
        </View>

        <View style={styles.organizerRow}>
          <Avatar
            name={cleanup.organizer.name}
            seed={cleanup.organizer.id}
            photoUrl={cleanup.organizer.avatarUrl}
            gradient={cleanup.organizer.avatar ?? null}
            size={22}
          />
          <Text variant="caption" color={th.colors.textMuted} numberOfLines={1} style={styles.organizerText}>
            {t("organizer.by_prefix")}{" "}
            <Text variant="caption" color={th.colors.text} style={styles.organizerName}>
              {cleanup.organizer.name}
            </Text>
          </Text>
          {affiliation ? (
            <OrgAffiliationBadge organization={affiliation} size="sm" interactive={false} />
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["3"],
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    padding: t.space["4"],
    ...t.shadows.s1,
  },
  cardHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  body: {
    flex: 1,
    gap: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  title: {
    flexShrink: 1,
  },
  joinedTag: {
    paddingHorizontal: t.space["2"],
    paddingVertical: 2,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.moss["50"],
  },
  joinedTagText: {
    fontFamily: t.fontFamily.bodySemiBold,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: t.space["3"],
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["1"],
  },
  metaItemGrow: {
    flexShrink: 1,
  },
  organizerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  organizerText: {
    flexShrink: 1,
  },
  organizerName: {
    fontFamily: t.fontFamily.bodySemiBold,
  },
}))
