import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AccessibilityInfo, View, Pressable, StyleSheet, Animated, Easing } from "react-native"
import { motion, makeThemedStyles, useTheme, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { Avatar } from "../primitives"
import { useAuthState, useCleanupAttendees, useEventHours } from "../data"
import { useNavStore } from "../nav"
import { useLocale, useT } from "../i18n"
import { formatHoursDisplay } from "./formatHours"
import { hoursReceiptState, type HoursReceiptState } from "./eventLifecycle"
import { LogHoursEditor, type LoggedHoursEntry } from "./LogHoursEditor"

export interface EventHoursBlockProps {
  cleanupId: string
  actsAsHost: boolean
  joined: boolean
}

export function EventHoursBlock({
  cleanupId,
  actsAsHost,
  joined,
}: EventHoursBlockProps) {
  const { user } = useAuthState()
  const hoursQuery = useEventHours(cleanupId)
  const data = hoursQuery.data
  const entries = useMemo<readonly LoggedHoursEntry[]>(() => data?.entries ?? [], [data])

  if (actsAsHost) {
    if (data === undefined && !hoursQuery.isError) return null
    return (
      <FadeUp>
        <HostHours cleanupId={cleanupId} entries={entries} />
      </FadeUp>
    )
  }

  const myEntry = user ? entries.find((entry) => entry.userId === user.id) : undefined
  const state = hoursReceiptState({
    status: "done",
    actsAsHost,
    joined,
    myHours: myEntry ? myEntry.hours : null,
    anyLogged: data?.anyLogged ?? false,
  })
  if (state === "hidden") return null
  return (
    <FadeUp>
      <AttendeeReceipt state={state} hours={myEntry?.hours ?? 0} />
    </FadeUp>
  )
}

function FadeUp({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(motion.fadeUp.distance)).current

  useEffect(() => {
    let mounted = true
    const timing = (value: Animated.Value, toValue: number) =>
      Animated.timing(value, {
        toValue,
        duration: motion.fadeUp.duration,
        easing: Easing.bezier(...motion.fadeUp.easing),
        useNativeDriver: true,
      })

    const enter = (reduceMotion: boolean) => {
      if (!mounted) return
      if (reduceMotion) {
        translateY.setValue(0)
        timing(opacity, 1).start()
        return
      }
      Animated.parallel([timing(opacity, 1), timing(translateY, 0)]).start()
    }

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => enter(!!enabled))
      .catch(() => enter(false))
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      if (!enabled) return
      translateY.stopAnimation()
      translateY.setValue(0)
    })

    return () => {
      mounted = false
      sub?.remove()
      opacity.stopAnimation()
      translateY.stopAnimation()
    }
  }, [opacity, translateY])

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>
  )
}


function HostHours({
  cleanupId,
  entries,
}: {
  cleanupId: string
  entries: readonly LoggedHoursEntry[]
}) {
  const [editing, setEditing] = useState(false)
  const stopEditing = useCallback(() => setEditing(false), [])
  const startEditing = useCallback(() => setEditing(true), [])

  if (entries.length === 0) return <LogHoursEditor cleanupId={cleanupId} />
  if (editing) {
    return (
      <LogHoursEditor
        cleanupId={cleanupId}
        initialEntries={entries}
        openOnMount
        onClose={stopEditing}
      />
    )
  }
  return <HoursSummaryCard cleanupId={cleanupId} entries={entries} onEdit={startEditing} />
}

function HoursSummaryCard({
  cleanupId,
  entries,
  onEdit,
}: {
  cleanupId: string
  entries: readonly LoggedHoursEntry[]
  onEdit: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-detail")
  const { locale } = useLocale()
  const { user } = useAuthState()
  const attendeesQuery = useCleanupAttendees(cleanupId)
  const attendees = attendeesQuery.data?.attendees
  const rosterSettled = attendees !== undefined || attendeesQuery.isError

  const byId = useMemo(
    () => new Map((attendees ?? []).map((attendee) => [attendee.id, attendee])),
    [attendees],
  )
  const total = useMemo(() => entries.reduce((sum, entry) => sum + entry.hours, 0), [entries])

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{t("log_hours.summary_eyebrow")}</Text>

      <View style={styles.totalRow}>
        <View style={styles.tile}>
          <Icon icon={iconMap.Award} size={16} color={th.colors.moss["700"]} />
        </View>
        <View style={styles.totalCol}>
          <Text style={styles.totalValue}>
            {t("log_hours.summary_total", { hours: formatHoursDisplay(total, locale) })}
          </Text>
          <Text style={styles.totalCount}>
            {t("log_hours.summary_count", { count: entries.length })}
          </Text>
        </View>
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("log_hours.summary_edit_a11y")}
          {...focusRingProps}
          style={({ pressed }) => [pressed ? styles.pressed : null]}
        >
          <Text style={styles.editText}>{t("log_hours.summary_edit")}</Text>
        </Pressable>
      </View>

      {rosterSettled ? (
        <View style={styles.people}>
          {entries.map((entry) => {
            const attendee = byId.get(entry.userId)
            const name = attendee
              ? user && attendee.id === user.id
                ? t("going.you")
                : attendee.name
              : t("log_hours.row_unknown")
            return (
              <View key={entry.userId} style={styles.personRow}>
                <Avatar
                  name={name}
                  seed={entry.userId}
                  photoUrl={attendee?.avatarUrl ?? null}
                  gradient={attendee?.avatar ?? null}
                  size={24}
                />
                <Text style={styles.personName} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.personHours}>
                  {t("volunteer-hours:ledger.hours_unit", { hours: formatHoursDisplay(entry.hours, locale) })}
                </Text>
              </View>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

function AttendeeReceipt({ state, hours }: { state: HoursReceiptState; hours: number }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-detail")
  const { locale } = useLocale()
  const onOpenHours = useCallback(() => {
    useNavStore.getState().push({ kind: "profile", profileTab: "hours" })
  }, [])

  if (state === "credited") {
    const label = formatHoursDisplay(hours, locale)
    return (
      <Pressable
        onPress={onOpenHours}
        accessibilityRole="button"
        accessibilityLabel={t("receipt.credited_a11y", { hours: label })}
        {...focusRingProps}
        style={({ pressed }) => [styles.credited, pressed ? styles.pressed : null]}
      >
        <Icon icon={iconMap.Award} size={16} color={th.colors.moss["700"]} />
        <Text style={styles.creditedText}>{t("receipt.credited", { hours: label })}</Text>
        <Icon icon={iconMap.ChevronRight} size={16} color={th.colors.moss["700"]} />
      </Pressable>
    )
  }

  return (
    <View style={styles.flatRow} accessibilityRole="text">
      <Icon icon={iconMap.Clock} size={15} color={th.colors.textSubtle} />
      <Text style={styles.flatRowText}>
        {state === "not-credited" ? t("receipt.not_credited") : t("receipt.pending")}
      </Text>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  verifyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    marginTop: t.space["3"],
    paddingVertical: t.space["3"],
    paddingHorizontal: t.space["3"] + 1,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.sky["50"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.sky["100"],
  },
  verifyNoteText: {
    flex: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: t.colors.sky["700"],
  },

  card: {
    marginTop: t.space["3"],
    padding: t.space["4"],
    gap: t.space["2"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s1,
  },
  eyebrow: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: t.colors.textSubtle,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  tile: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.moss["50"],
  },
  totalCol: {
    flex: 1,
    minWidth: 0,
  },
  totalValue: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 15,
    color: t.colors.text,
  },
  totalCount: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textMuted,
  },
  editText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
    color: t.colors.accentText,
  },
  people: {
    gap: t.space["2"],
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  personName: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 13,
    color: t.colors.text,
  },
  personHours: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
    color: t.colors.textMuted,
  },

  credited: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    marginTop: t.space["3"],
    paddingVertical: t.space["3"],
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.moss["50"],
    borderWidth: 1.5,
    borderColor: t.colors.moss["100"],
  },
  creditedText: {
    flex: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 13.5,
    color: t.colors.moss["700"],
  },
  flatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: t.space["3"],
  },
  flatRowText: {
    flex: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13,
    color: t.colors.textMuted,
  },

  pressed: {
    opacity: 0.85,
  },
}))
