import React, { useMemo, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import type { CleanupDTO, LinkedEventRef } from "@civfix/shared"
import { makeThemedStyles, useTheme, focusRingProps, webCursor, webHover, webTransition } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { Avatar } from "../primitives/Avatar"
import { RsvpPill } from "../primitives/RsvpPill"
import { useCleanup, useCleanupAttendees, useJoinCleanup } from "../data"
import { useLocale, useT } from "../i18n"
import { buildLinkedEventCardModel, buildLinkedEventCardTargetPlan } from "./linkedEventCardModel"
import { hasEventEnded } from "./eventLifecycle"
export { buildLinkedEventCardModel, buildLinkedEventCardTargetPlan } from "./linkedEventCardModel"

export interface LinkedEventCardProps {
  event: LinkedEventRef
  cleanup?: CleanupDTO
  onPress?: () => void
  layout?: "strip" | "list"
  selectable?: boolean
  selected?: boolean
  onRemove?: () => void
  timeZone?: string
  showAttendees?: boolean
}

const FOOTER_STACK_MIN_WIDTH = 224

function AttendeeStack({
  model,
  showAvatars,
}: {
  model: ReturnType<typeof buildLinkedEventCardModel>
  showAvatars: boolean
}) {
  const styles = useStyles()
  const t = useTheme()
  const visibleCount = Math.min(3, Math.max(model.attendeePreview.length, Math.min(3, model.going)))

  return (
    <View style={styles.attendeeGroup} accessible={false}>
      {showAvatars ? (
        <View style={styles.avatarStack}>
          {Array.from({ length: visibleCount }).map((_, index) => {
            const attendee = model.attendeePreview[index]
            return attendee ? (
              <View key={attendee.id} style={[styles.avatarShell, index > 0 ? styles.avatarOverlap : null]}>
                <Avatar
                  name={attendee.name}
                  seed={attendee.id}
                  photoUrl={attendee.avatarUrl}
                  gradient={attendee.avatar ?? null}
                  size={22}
                  decorative
                />
              </View>
            ) : (
              <View
                key={`attendee-${index}`}
                style={[
                  styles.attendeePlaceholder,
                  index > 0 ? styles.avatarOverlap : null,
                  index % 2 === 0 ? styles.placeholderCoral : styles.placeholderMoss,
                ]}
              />
            )
          })}
        </View>
      ) : null}
      <Text
        variant="caption"
        color={t.colors.textMuted}
        numberOfLines={1}
        style={styles.goingText}
      >
        {model.goingLabel}
      </Text>
    </View>
  )
}

export function LinkedEventCard({
  event,
  cleanup,
  onPress,
  layout = "strip",
  selectable = false,
  selected = false,
  onRemove,
  timeZone,
  showAttendees = false,
}: LinkedEventCardProps) {
  const styles = useStyles()
  const th = useTheme()
  const { locale } = useLocale()
  const { t } = useT("event-card")
  const detail = useCleanup(cleanup ? undefined : event.id)
  const attendeeQuery = useCleanupAttendees(showAttendees && !selectable ? event.id : undefined)
  const join = useJoinCleanup(event.id)
  const liveCleanup = cleanup ?? detail.data
  const address = liveCleanup?.address
  const liveGoing = liveCleanup?.going ?? attendeeQuery.data?.going
  const joined = liveCleanup?.joined
  const attendees = attendeeQuery.data?.attendees
  const model = useMemo(
    () =>
      buildLinkedEventCardModel(event, t, locale, timeZone, {
        address,
        going: liveGoing,
        joined,
        attendees,
      }),
    [event, t, locale, timeZone, address, liveGoing, joined, attendees],
  )
  const isList = layout === "list"
  const targets = buildLinkedEventCardTargetPlan()
  const [footerWidth, setFooterWidth] = useState<number | null>(null)
  const showAvatars = footerWidth === null || footerWidth >= FOOTER_STACK_MIN_WIDTH

  const card = (
    <View
      style={[
        styles.card,
        isList ? styles.cardList : styles.cardStrip,
        selectable && selected ? styles.selected : null,
      ]}
    >
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={selectable ? "checkbox" : "button"}
        accessibilityState={selectable ? { checked: selected } : undefined}
        accessibilityLabel={model.accessibilityLabel}
        {...focusRingProps}
        style={(state) => [
          styles.eventTarget,
          webTransition,
          webCursor(!onPress),
          webHover(state) && onPress ? styles.hovered : null,
          state.pressed && onPress ? styles.pressed : null,
        ]}
      >
        <View style={[styles.dateChip, isList ? styles.dateChipList : null]}>
          <Text style={styles.month}>{model.month}</Text>
          <Text style={styles.day}>{model.day}</Text>
        </View>

        <View style={styles.body}>
          <Text variant="bodyStrong" numberOfLines={2} style={styles.title}>
            {model.title}
          </Text>
          <Text variant="caption" color={th.colors.textMuted} numberOfLines={1}>
            {model.scheduleLabel}
          </Text>
          <View style={styles.locationRow}>
            <Icon icon={iconMap.MapPin} size={13} color={th.colors.textMuted} />
            <Text
              variant="caption"
              color={th.colors.textMuted}
              numberOfLines={1}
              style={styles.location}
            >
              {model.locationLabel}
            </Text>
          </View>
        </View>

        {selectable ? (
          <View style={[styles.check, selected ? styles.checkSelected : null]}>
            {selected ? <Icon icon={iconMap.Check} size={14} color={th.colors.onAccent} /> : null}
          </View>
        ) : null}
      </Pressable>

      {selectable ? null : (
        <View
          style={styles.footerRow}
          onLayout={(event) => {
            const width = event.nativeEvent.layout.width
            setFooterWidth((current) => (current === width ? current : width))
          }}
        >
          <AttendeeStack model={model} showAvatars={showAvatars} />
          <RsvpPill
            going={model.rsvpActive}
            onToggle={(currentlyGoing) => join.mutate(currentlyGoing)}
            nextPath={`/cleanups/${event.id}`}
            busy={join.isPending || (!cleanup && detail.isLoading)}
            ended={hasEventEnded(liveCleanup ?? event, Date.now())}
            size="md"
          />
        </View>
      )}
    </View>
  )

  if (!onRemove) return card

  return (
    <View style={isList ? styles.removeWrapList : styles.removeWrap}>
      {card}
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={model.removeAccessibilityLabel}
        {...focusRingProps}
        style={({ pressed }) => [styles.removeButton, targets.removeTarget, pressed ? styles.pressed : null]}
      >
        <View style={[styles.removeVisual, targets.removeVisual]}>
          <Icon icon={iconMap.Close} size={13} color={th.colors.neutral.card} />
        </View>
      </Pressable>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  card: {
    padding: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.sun["300"],
    backgroundColor: t.colors.sun["100"],
    overflow: "hidden",
  },
  cardStrip: {
    width: 292,
  },
  cardList: {
    width: "100%",
  },
  selected: {
    borderWidth: 1.5,
    borderColor: t.colors.brand.bloom,
    backgroundColor: t.colors.bloom["50"],
  },
  eventTarget: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    borderRadius: 14,
  },
  hovered: {
    opacity: 0.86,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  dateChip: {
    width: 52,
    minHeight: 58,
    flexShrink: 0,
    borderRadius: 14,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.sun["300"],
  },
  dateChipList: {
    width: 52,
  },
  month: {
    color: t.colors.sun["700"],
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.8,
  },
  day: {
    color: t.colors.text,
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 21,
    lineHeight: 24,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 15.5,
    lineHeight: 19,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  location: {
    flex: 1,
  },
  footerRow: {
    minHeight: 44,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  attendeeGroup: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  avatarStack: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  avatarShell: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: t.colors.sun["100"],
    backgroundColor: t.colors.surface,
  },
  avatarOverlap: {
    marginLeft: -7,
  },
  attendeePlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: t.colors.sun["100"],
  },
  placeholderCoral: {
    backgroundColor: t.colors.bloom["300"],
  },
  placeholderMoss: {
    backgroundColor: t.colors.moss["300"],
  },
  goingText: {
    flexShrink: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.bodySemiBold,
  },
  check: {
    width: 24,
    height: 24,
    flexShrink: 0,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.surface,
  },
  checkSelected: {
    borderColor: t.colors.brand.bloom,
    backgroundColor: t.colors.brand.bloom,
  },
  removeWrap: {
    position: "relative",
  },
  removeWrapList: {
    width: "100%",
    position: "relative",
  },
  removeButton: {
    position: "absolute",
    top: -16,
    right: -16,
    alignItems: "center",
    justifyContent: "center",
  },
  removeVisual: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: t.colors.surface,
    backgroundColor: t.colors.text,
    ...t.shadows.s1,
  },
}))
