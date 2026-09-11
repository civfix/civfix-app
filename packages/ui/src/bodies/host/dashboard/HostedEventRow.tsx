import React, { memo, useCallback, useState } from "react"
import { Image, Pressable, StyleSheet, View } from "react-native"
import type { CleanupMemberRole, HostedEventDTO } from "@civfix/shared"
import { eventChip, dowLabel, timeLabel } from "@civfix/shared/datetime"
import {
  focusRingProps,
  makeThemedStyles,
  useTheme,
  webCursorPointer,
  webHover,
  webTransition,
} from "../../../theme"
import { Text, Icon, iconMap } from "../../../typography"
import { MetaDot, PopoverMenu, usePopoverAnchor } from "../../../primitives"
import type { AnchorRect, PopoverMenuItem } from "../../../primitives"
import { useLocale, useRelativeTime, useT } from "../../../i18n"
import { RoleChip } from "../../RoleChip"
import { hostedEventActions, hostedEventHasActions } from "./dashboardModel"

const CLOSED = "closed"

export interface HostedEventRowProps {
  event: HostedEventDTO
  roleLabel: (role: CleanupMemberRole) => string
  onOpen: (event: HostedEventDTO) => void
  onHostTools: (event: HostedEventDTO) => void
  onEmailAttendees: (event: HostedEventDTO) => void
  onDuplicate: (event: HostedEventDTO) => void
  onEdit: (event: HostedEventDTO) => void
}

function WhenLine({ startsAt }: { startsAt: string }) {
  const styles = useStyles()
  const th = useTheme()
  const { locale } = useLocale()
  const { weekdays } = useRelativeTime()
  const parts = [dowLabel(startsAt, weekdays), timeLabel(startsAt, locale)]
  return (
    <View style={styles.subRow}>
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <MetaDot color={th.colors.textSubtle} style={styles.subDot} /> : null}
          <Text style={styles.sub} numberOfLines={1}>
            {part}
          </Text>
        </React.Fragment>
      ))}
    </View>
  )
}

function DateBlock({ startsAt, coverThumbUrl }: { startsAt: string; coverThumbUrl?: string | null }) {
  const styles = useStyles()
  const { locale } = useLocale()
  const { day, month } = eventChip(startsAt, locale)
  if (coverThumbUrl) {
    return (
      <Image source={{ uri: coverThumbUrl }} style={styles.cover} accessibilityIgnoresInvertColors />
    )
  }
  return (
    <View style={styles.date}>
      <Text style={styles.dateDay}>{day}</Text>
      <Text style={styles.dateMonth}>{month}</Text>
    </View>
  )
}

export const HostedEventRow = memo(function HostedEventRow({
  event,
  roleLabel,
  onOpen,
  onHostTools,
  onEmailAttendees,
  onDuplicate,
  onEdit,
}: HostedEventRowProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-dashboard")
  const [menuOpen, setMenuOpen] = useState<string>(CLOSED)
  const [menuRect, setMenuRect] = useState<AnchorRect | null>(null)
  const { ref: menuAnchorRef, measure: measureMenu } = usePopoverAnchor(setMenuRect)

  const actions = hostedEventActions(event)
  const hasMenu = hostedEventHasActions(actions)

  const open = useCallback(() => onOpen(event), [event, onOpen])
  const openMenu = useCallback(() => {
    measureMenu()
    setMenuOpen("actions")
  }, [measureMenu])
  const close = useCallback(() => setMenuOpen(CLOSED), [])

  const run = useCallback(
    (action: (event: HostedEventDTO) => void) => () => {
      setMenuOpen(CLOSED)
      action(event)
    },
    [event],
  )

  const items: PopoverMenuItem[] = [
    ...(actions.hostTools
      ? [
          {
            key: "host-tools",
            label: t("events.host_tools"),
            icon: "Building" as const,
            onPress: run(onHostTools),
          },
        ]
      : []),
    ...(actions.emailAttendees
      ? [
          {
            key: "email",
            label: t("events.email_attendees"),
            icon: "Mail" as const,
            onPress: run(onEmailAttendees),
          },
        ]
      : []),
    ...(actions.duplicate
      ? [
          {
            key: "duplicate",
            label: t("events.duplicate"),
            icon: "Copy" as const,
            onPress: run(onDuplicate),
          },
        ]
      : []),
    ...(actions.edit
      ? [
          {
            key: "edit",
            label: t("events.edit"),
            icon: "Pencil" as const,
            onPress: run(onEdit),
          },
        ]
      : []),
  ]

  return (
    <View style={styles.rowOuter}>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={t("events.open_a11y", { title: event.title })}
        {...focusRingProps}
        style={({ pressed }) => [styles.rowMain, pressed ? styles.rowPressed : null]}
      >
        <DateBlock startsAt={event.startsAt} coverThumbUrl={event.coverThumbUrl ?? null} />
        <View style={styles.meta}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {event.title}
            </Text>
            {event.myRole ? (
              <RoleChip
                label={roleLabel(event.myRole)}
                tone={event.myRole === "organizer" ? "lead" : "neutral"}
              />
            ) : null}
          </View>
          <WhenLine startsAt={event.startsAt} />
          <Text style={styles.counts} numberOfLines={1}>
            {t("events.counts", {
              registered: event.registeredCount,
              checkedIn: event.checkedInCount,
            })}
          </Text>
        </View>
      </Pressable>
      {hasMenu ? (
        <Pressable
          ref={menuAnchorRef}
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel={t("events.actions_a11y", { title: event.title })}
          accessibilityState={{ expanded: menuOpen !== CLOSED }}
          hitSlop={6}
          {...focusRingProps}
          style={(state) => [
            styles.kebab,
            webTransition,
            webCursorPointer,
            webHover(state) ? styles.kebabHovered : null,
            state.pressed ? styles.rowPressed : null,
          ]}
        >
          <Icon icon={iconMap.Ellipsis} size={18} color={th.colors.textSubtle} />
        </Pressable>
      ) : null}
      {hasMenu ? (
        <PopoverMenu
          visible={menuOpen === "actions"}
          anchorRect={menuRect}
          onClose={close}
          items={items}
        />
      ) : null}
    </View>
  )
})

const useStyles = makeThemedStyles((t) => ({
  rowOuter: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    paddingRight: t.space["2"],
    ...t.shadows.s1,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: t.radius.lg,
  },
  rowPressed: {
    opacity: 0.92,
  },
  kebab: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
  },
  kebabHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  date: {
    width: 46,
    height: 46,
    flexShrink: 0,
    borderRadius: t.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
  },
  dateDay: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: 19,
    lineHeight: 20,
    color: t.colors.text,
  },
  dateMonth: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 9,
    letterSpacing: 0.5,
    marginTop: 2,
    color: t.colors.textMuted,
  },
  cover: {
    width: 46,
    height: 46,
    flexShrink: 0,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.bgAlt,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  title: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14.5,
    color: t.colors.text,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  sub: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textSubtle,
  },
  subDot: {
    marginHorizontal: 5,
  },
  counts: {
    marginTop: 2,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12,
    color: t.colors.textMuted,
  },
}))
