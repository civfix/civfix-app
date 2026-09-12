import React, { memo, useCallback, useState } from "react"
import { Image, Pressable, View } from "react-native"
import type { CleanupMemberRole, HostedEventDTO } from "@civfix/shared"
import { dowLabel, timeLabel } from "@civfix/shared/datetime"
import {
  focusRingProps,
  makeThemedStyles,
  useTheme,
  webCursorPointer,
  webHover,
  webTransition,
} from "../../../theme"
import { Text, Icon, iconMap } from "../../../typography"
import { DateBadge, MetaDot, PopoverMenu, usePopoverAnchor } from "../../../primitives"
import type { AnchorRect, PopoverMenuItem } from "../../../primitives"
import { useLocale, useRelativeTime, useT } from "../../../i18n"
import { RoleChip } from "../../RoleChip"
import { hostedEventActions, hostedEventCan, hostedEventHasActions } from "./dashboardModel"

const CLOSED = "closed"

const DATE_BADGE_SIZE = 48

export interface HostedEventRowProps {
  event: HostedEventDTO
  roleLabel: (role: CleanupMemberRole) => string
  live: boolean
  onOpen: (event: HostedEventDTO) => void
  onCheckIn: (event: HostedEventDTO) => void
  onHostTools: (event: HostedEventDTO) => void
  onEmailAttendees: (event: HostedEventDTO) => void
  onDuplicate: (event: HostedEventDTO) => void
  onEdit: (event: HostedEventDTO) => void
}

function MetaLine({ parts }: { parts: readonly string[] }) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <View style={styles.subRow}>
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <MetaDot color={th.colors.textSubtle} style={styles.subDot} /> : null}
          <Text variant="caption" numberOfLines={1}>
            {part}
          </Text>
        </React.Fragment>
      ))}
    </View>
  )
}

function EventBadge({ startsAt, coverThumbUrl }: { startsAt: string; coverThumbUrl?: string | null }) {
  const styles = useStyles()
  if (coverThumbUrl) {
    return (
      <Image source={{ uri: coverThumbUrl }} style={styles.cover} accessibilityIgnoresInvertColors />
    )
  }
  return <DateBadge iso={startsAt} size={DATE_BADGE_SIZE} />
}

export const HostedEventRow = memo(function HostedEventRow({
  event,
  roleLabel,
  live,
  onOpen,
  onCheckIn,
  onHostTools,
  onEmailAttendees,
  onDuplicate,
  onEdit,
}: HostedEventRowProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-dashboard")
  const { locale } = useLocale()
  const { weekdays } = useRelativeTime()
  const [menuOpen, setMenuOpen] = useState<string>(CLOSED)
  const [menuRect, setMenuRect] = useState<AnchorRect | null>(null)
  const { ref: menuAnchorRef, measure: measureMenu } = usePopoverAnchor(setMenuRect)

  const actions = hostedEventActions(event)
  const hasMenu = hostedEventHasActions(actions)
  const canCheckIn = live && hostedEventCan(event, "check_in")

  const open = useCallback(() => onOpen(event), [event, onOpen])
  const checkIn = useCallback(() => onCheckIn(event), [event, onCheckIn])
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

  const capacity = event.capacity ?? null
  const meta = [
    capacity !== null
      ? t("events.meta_capacity", { registered: event.registeredCount, capacity })
      : t("events.meta_registered", { count: event.registeredCount }),
    ...(event.waitlistCount > 0 ? [t("events.meta_waiting", { count: event.waitlistCount })] : []),
    ...(event.checkedInCount > 0
      ? [t("events.meta_checked_in", { count: event.checkedInCount })]
      : []),
  ]

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
        style={(state) => [
          styles.rowMain,
          webTransition,
          webCursorPointer,
          webHover(state) ? styles.rowHovered : null,
          state.pressed ? styles.rowPressed : null,
        ]}
      >
        <EventBadge startsAt={event.startsAt} coverThumbUrl={event.coverThumbUrl ?? null} />
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
          <MetaLine parts={[dowLabel(event.startsAt, weekdays), timeLabel(event.startsAt, locale)]} />
          <MetaLine parts={meta} />
        </View>
      </Pressable>
      {canCheckIn ? (
        <Pressable
          onPress={checkIn}
          accessibilityRole="button"
          accessibilityLabel={t("events.check_in_a11y", { title: event.title })}
          hitSlop={ACTION_HIT_SLOP}
          {...focusRingProps}
          style={(state) => [
            styles.action,
            webTransition,
            webCursorPointer,
            webHover(state) ? styles.actionHovered : null,
            state.pressed ? styles.rowPressed : null,
          ]}
        >
          <Icon icon={iconMap.QrCode} size={18} color={th.colors.textMuted} />
        </Pressable>
      ) : null}
      {hasMenu ? (
        <Pressable
          ref={menuAnchorRef}
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel={t("events.actions_a11y", { title: event.title })}
          accessibilityState={{ expanded: menuOpen !== CLOSED }}
          hitSlop={ACTION_HIT_SLOP}
          {...focusRingProps}
          style={(state) => [
            styles.action,
            webTransition,
            webCursorPointer,
            webHover(state) ? styles.actionHovered : null,
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

const ACTION_SIZE = 32

const MIN_TOUCH_TARGET = 44

const ACTION_HIT_SLOP = (MIN_TOUCH_TARGET - ACTION_SIZE) / 2

const useStyles = makeThemedStyles((t) => ({
  rowOuter: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["1"],
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: t.space["2"],
    borderRadius: t.radius.md,
  },
  rowHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  rowPressed: {
    opacity: 0.92,
  },
  action: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
  },
  actionHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  cover: {
    width: DATE_BADGE_SIZE,
    height: DATE_BADGE_SIZE,
    flexShrink: 0,
    borderRadius: t.radius.sm,
    backgroundColor: t.colors.bgAlt,
  },
  meta: {
    flex: 1,
    minWidth: 0,
    gap: t.space["1"],
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  title: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  subDot: {
    marginHorizontal: t.space["1"],
  },
}))
