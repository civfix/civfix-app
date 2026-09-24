import React, { memo, useCallback, useState } from "react"
import { Image, View } from "react-native"
import type { CleanupMemberRole, HostedEventDTO } from "@civfix/shared"
import { safeDateFormat } from "@civfix/shared/datetime"
import { makeThemedStyles, useTheme } from "../../../theme"
import { Text, iconMap } from "../../../typography"
import type { IconName } from "../../../typography"
import {
  DateBadge,
  IconActionButton,
  LIST_TILE,
  ListRow,
  MetaDot,
  PopoverMenu,
  usePopoverAnchor,
} from "../../../primitives"
import type { AnchorRect, PopoverMenuItem } from "../../../primitives"
import { useEventWhen, useLocale, useRelativeTime, useT } from "../../../i18n"
import { RoleChip } from "../../RoleChip"
import { formatHoursDisplay } from "../../formatHours"
import { PhaseDot } from "../PhaseHeader"
import {
  hostedEventActions,
  hostedEventHasActions,
  hostedEventStatus,
  hostedEventWhen,
  pastRowMeta,
  type HostedEventActions,
} from "./dashboardModel"
import { hasHostCapability } from "../../../data/hooks/host"

const CLOSED = "closed"

export type HostedEventWindow = "upcoming" | "past"

interface MenuEntry {
  flag: keyof HostedEventActions
  key: string
  label: string
  icon: IconName
  action: (event: HostedEventDTO) => void
}

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
  onOpenChat: (event: HostedEventDTO) => void
  onAnnounce: (event: HostedEventDTO) => void
  onDuplicate: (event: HostedEventDTO) => void
  onEdit: (event: HostedEventDTO) => void
}

const PAST_DATE_OPTIONS: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }

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

function EventBadge({
  startsAt,
  timeZone,
  coverThumbUrl,
}: {
  startsAt: string
  timeZone: string | undefined
  coverThumbUrl?: string | null
}) {
  const styles = useStyles()
  if (coverThumbUrl) {
    return (
      <Image source={{ uri: coverThumbUrl }} style={styles.cover} accessibilityIgnoresInvertColors />
    )
  }
  return <DateBadge iso={startsAt} size={LIST_TILE} timeZone={timeZone} />
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
  onOpenChat,
  onAnnounce,
  onDuplicate,
  onEdit,
}: HostedEventRowProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-dashboard")
  const { locale } = useLocale()
  const { relative } = useRelativeTime()
  const [menuOpen, setMenuOpen] = useState<string>(CLOSED)
  const [menuRect, setMenuRect] = useState<AnchorRect | null>(null)
  const { ref: menuAnchorRef, measure: measureMenu } = usePopoverAnchor(setMenuRect)

  const actions = hostedEventActions(event, now)
  const hasMenu = hostedEventHasActions(actions)
  const canCheckIn = live && hasHostCapability(event, "check_in")

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
  const when = useEventWhen(hostedEventWhen(event))
  const metaParts: MetaPart[] =
    eventWindow === "past"
      ? [
          { key: "when", text: safeDateFormat(event.startsAt, locale, PAST_DATE_OPTIONS, event.timezone) },
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
              : `${when.dow} ${when.timeWithZone}`,
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

  const menuEntries: readonly MenuEntry[] = [
    {
      flag: "hostTools",
      key: "host-tools",
      label: t("events.host_tools"),
      icon: "Building",
      action: onHostTools,
    },
    {
      flag: "chat",
      key: "chat",
      label: t("events.open_chat"),
      icon: "MessageCircle",
      action: onOpenChat,
    },
    {
      flag: "announce",
      key: "announce",
      label: t("events.announce"),
      icon: "Megaphone",
      action: onAnnounce,
    },
    {
      flag: "duplicate",
      key: "duplicate",
      label: t("events.duplicate"),
      icon: "Copy",
      action: onDuplicate,
    },
    {
      flag: "edit",
      key: "edit",
      label: t("events.edit"),
      icon: "Pencil",
      action: onEdit,
    },
  ]
  const items: PopoverMenuItem[] = menuEntries
    .filter((entry) => actions[entry.flag])
    .map(({ key, label, icon, action }) => ({ key, label, icon, onPress: run(action) }))

  return (
    <>
      <ListRow
        leading={
          <EventBadge
            startsAt={event.startsAt}
            timeZone={when.timeZone}
            coverThumbUrl={event.coverThumbUrl ?? null}
          />
        }
        title={event.title}
        sub={<MetaLine parts={metaParts} chip={chip} leading={dot} />}
        accessibilityLabel={t("events.open_a11y", { title: event.title })}
        onPress={open}
        trailing={
          canCheckIn || hasMenu ? (
            <View style={styles.actions}>
              {canCheckIn ? (
                <IconActionButton
                  icon={iconMap.QrCode}
                  iconColor={th.colors.textMuted}
                  onPress={checkIn}
                  accessibilityLabel={t("events.check_in_a11y", { title: event.title })}
                />
              ) : null}
              {hasMenu ? (
                <IconActionButton
                  ref={menuAnchorRef}
                  icon={iconMap.Ellipsis}
                  iconColor={th.colors.textSubtle}
                  onPress={openMenu}
                  accessibilityLabel={t("events.actions_a11y", { title: event.title })}
                  accessibilityState={{ expanded: menuOpen !== CLOSED }}
                />
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
