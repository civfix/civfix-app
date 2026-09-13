import React, { memo, useCallback, useState } from "react"
import { Image, Pressable, View } from "react-native"
import type { CleanupMemberRole, HostedEventDTO } from "@civfix/shared"
import { eventWhenParts } from "@civfix/shared/datetime"
import {
  focusRingProps,
  makeThemedStyles,
  useTheme,
  webCursorPointer,
  webHover,
  webTransition,
} from "../../../theme"
import { Text, Icon, iconMap } from "../../../typography"
import {
  DateBadge,
  LIST_TILE,
  ListRow,
  MetaDot,
  PopoverMenu,
  usePopoverAnchor,
} from "../../../primitives"
import type { AnchorRect, PopoverMenuItem } from "../../../primitives"
import { useLocale, useRelativeTime, useT } from "../../../i18n"
import { RoleChip } from "../../RoleChip"
import { formatHoursDisplay } from "../../formatHours"
import { PhaseDot } from "../PhaseHeader"
import {
  hostedEventActions,
  hostedEventCan,
  hostedEventHasActions,
  hostedEventStatus,
  hostedEventWhen,
  pastRowMeta,
} from "./dashboardModel"

const CLOSED = "closed"

const ACTION_SIZE = 32

const MIN_TOUCH_TARGET = 44

const ACTION_HIT_SLOP = (MIN_TOUCH_TARGET - ACTION_SIZE) / 2

export type HostedEventWindow = "upcoming" | "past"

type MetaTone = "warn" | "muted"

interface MetaPart {
  key: string
  text: string
  tone?: MetaTone
}

export interface HostedEventRowProps {
  event: HostedEventDTO
  window: HostedEventWindow
  roleLabel: (role: CleanupMemberRole) => string
  live: boolean
  now: Date
  onOpen: (event: HostedEventDTO) => void
  onCheckIn: (event: HostedEventDTO) => void
  onHostTools: (event: HostedEventDTO) => void
  onEmailAttendees: (event: HostedEventDTO) => void
  onDuplicate: (event: HostedEventDTO) => void
  onEdit: (event: HostedEventDTO) => void
}

function pastDateLabel(iso: string, locale: string, timeZone: string | undefined): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ""
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      ...(timeZone ? { timeZone } : {}),
    }).format(at)
  } catch {
    return iso.slice(0, 10)
  }
}

function MetaLine({
  parts,
  chip,
  leading,
}: {
  parts: readonly MetaPart[]
  chip?: React.ReactNode
  leading?: React.ReactNode
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <View style={styles.subRow}>
      {leading ? <View style={styles.subLead}>{leading}</View> : null}
      {parts.map((part, index) => (
        <React.Fragment key={part.key}>
          {index > 0 ? <MetaDot color={th.colors.textSubtle} /> : null}
          <Text
            variant="caption"
            numberOfLines={1}
            style={[
              index === parts.length - 1 && !chip ? styles.subLast : styles.subFixed,
              part.tone === "warn" ? styles.subWarn : null,
              part.tone === "muted" ? styles.subMuted : null,
            ]}
          >
            {part.text}
          </Text>
        </React.Fragment>
      ))}
      {chip ? (
        <>
          {parts.length > 0 ? <MetaDot color={th.colors.textSubtle} /> : null}
          {chip}
        </>
      ) : null}
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
  return <DateBadge iso={startsAt} size={LIST_TILE} />
}

export const HostedEventRow = memo(function HostedEventRow({
  event,
  window: eventWindow,
  roleLabel,
  live,
  now,
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
  const { relative, weekdays } = useRelativeTime()
  const [menuOpen, setMenuOpen] = useState<string>(CLOSED)
  const [menuRect, setMenuRect] = useState<AnchorRect | null>(null)
  const { ref: menuAnchorRef, measure: measureMenu } = usePopoverAnchor(setMenuRect)

  const actions = hostedEventActions(event, now)
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
  const past = pastRowMeta(event)
  const underway = hostedEventStatus(event, now) === "active"
  const parts = eventWhenParts(hostedEventWhen(event), { locale, weekdays, now: now.getTime() })
  const metaParts: MetaPart[] =
    eventWindow === "past"
      ? [
          { key: "when", text: pastDateLabel(event.startsAt, locale, event.timezone ?? undefined) },
          ...(past.cancelled
            ? [{ key: "cancelled", text: t("events.meta_cancelled"), tone: "muted" as const }]
            : []),
          ...(past.showedUp
            ? [
                {
                  key: "showed_up",
                  text: t("events.meta_showed_up", {
                    checkedIn: event.checkedInCount,
                    registered: event.registeredCount,
                  }),
                },
              ]
            : []),
          ...(past.hoursToken === "hours"
            ? [
                {
                  key: "hours",
                  text: t("events.meta_hours", {
                    hours: formatHoursDisplay(event.hoursCredited ?? 0, locale),
                  }),
                },
              ]
            : []),
          ...(past.hoursToken === "not_logged"
            ? [{ key: "hours", text: t("events.meta_hours_not_logged"), tone: "warn" as const }]
            : []),
        ]
      : [
          {
            key: "when",
            text: underway
              ? t("events.meta_underway", { ago: relative(event.startsAt, now) })
              : `${parts.dow} ${parts.time}${parts.zone === null ? "" : ` ${parts.zone}`}`,
          },
          {
            key: "seats",
            text:
              capacity !== null
                ? t("events.meta_capacity", { registered: event.registeredCount, capacity })
                : t("events.meta_signed_up", { count: event.registeredCount }),
          },
          ...(event.waitlistCount > 0
            ? [{ key: "waiting", text: t("events.meta_waiting", { count: event.waitlistCount }) }]
            : []),
        ]

  const dot = underway ? <PhaseDot phase="live" /> : null

  const chip =
    eventWindow === "upcoming" && event.myRole && event.myRole !== "organizer" ? (
      <RoleChip label={roleLabel(event.myRole)} tone="neutral" />
    ) : null

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
    <>
      <ListRow
        leading={
          <EventBadge startsAt={event.startsAt} coverThumbUrl={event.coverThumbUrl ?? null} />
        }
        title={event.title}
        sub={<MetaLine parts={metaParts} chip={chip} leading={dot} />}
        accessibilityLabel={t("events.open_a11y", { title: event.title })}
        onPress={open}
        trailing={
          canCheckIn || hasMenu ? (
            <View style={styles.actions}>
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
                    state.pressed ? styles.actionPressed : null,
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
                    state.pressed ? styles.actionPressed : null,
                  ]}
                >
                  <Icon icon={iconMap.Ellipsis} size={18} color={th.colors.textSubtle} />
                </Pressable>
              ) : null}
            </View>
          ) : null
        }
      />
      {hasMenu ? (
        <PopoverMenu
          visible={menuOpen === "actions"}
          anchorRect={menuRect}
          onClose={close}
          items={items}
        />
      ) : null}
    </>
  )
})

const useStyles = makeThemedStyles((t) => ({
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["1"],
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
  actionPressed: {
    opacity: 0.92,
  },
  cover: {
    width: LIST_TILE,
    height: LIST_TILE,
    flexShrink: 0,
    borderRadius: t.radius.sm,
    backgroundColor: t.colors.bgAlt,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  subLead: {
    flexShrink: 0,
    marginRight: t.space["1"],
  },
  subLast: {
    flexShrink: 1,
  },
  subFixed: {
    flexShrink: 0,
  },
  subMuted: {
    flexShrink: 0,
    color: t.colors.textSubtle,
  },
  subWarn: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    lineHeight: 16,
    color: t.colors.sun["700"],
  },
}))
