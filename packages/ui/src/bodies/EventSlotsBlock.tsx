/**
 * EventSlotsBlock - the ATTENDEE-facing signup-slot picker for an event ("Check-in table", "Truck
 * driver", ...). One row per slot; the trailing pill claims, switches or releases.
 *
 * CREATED HERE, MOUNTED BY EventDetailBody: this file deliberately touches nothing else. The detail body
 * renders it below the actions row for an UPCOMING/ACTIVE event and again, `readonly`, in the DONE region
 * so a past event still shows who did what.
 *
 * ONE MUTATION, NOT THREE. The viewer's slot is a SINGULAR resource (`PUT /cleanups/:id/slot`), so claim,
 * switch and release are all `useClaimEventSlot(cleanupId)`: `{ slotId }` claims or moves, `{ slotId: null }`
 * releases. There is no separate join call either - claiming auto-RSVPs a non-member in the same server
 * transaction, which is what the `claim_joins_hint` line tells a viewer who has not RSVP'd yet.
 *
 * THE ROW IS NOT A PRESSABLE - only the trailing pill is. Two reasons, both load-bearing: react-native-web
 * renders `Pressable` as a `<button>` and nesting one inside another is invalid DOM the browser silently
 * re-parents, and a whole-row target would make "tap anywhere to claim" ambiguous next to a row whose only
 * meaningful action is on the right. Every state's ownership comes off the server's `slot.mine` flag via
 * `eventSlotsModel`, never re-derived from a roster.
 *
 * No `Modal`, no `FlatList`, no inner `ScrollView` - this block renders inside the gorhom sheet's scroller
 * (see the same constraint on `SlotEditor`).
 */
import React, { useCallback, useState } from "react"
import { View, Pressable, StyleSheet, Animated } from "react-native"
import { useQueryClient } from "@tanstack/react-query"
import type { EventSlotDTO } from "@civfix/shared"
import { timeRangeLabel } from "@civfix/shared/datetime"
import { makeThemedStyles, useTheme, webCursorPointer, webTransition, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { MetaDot, useToast } from "../primitives"
import { POP_ENABLED, usePopScale } from "../primitives/usePopScale"
import { cleanupDetailFilters, useClaimEventSlot, useRequireAuth } from "../data"
import { useLocale, useT } from "../i18n"
import { appErrorCode } from "./errorCode"
import {
  boardHasTimedSlots,
  mySlotId,
  slotDisplayOrder,
  slotRemaining,
  slotRowState,
  slotsFilledSummary,
  slotWindow,
  type SlotRowState,
} from "./eventSlotsModel"

/**
 * Vertical slop that turns the 30pt pill into a 44pt effective target (30 + 7 + 7). Applied on all four
 * edges: the horizontal padding already clears 44 for every label, and symmetric slop stays inside the
 * row's own 12pt padding, so no row's slop can reach into its neighbour's.
 */
const PILL_HIT_SLOP = 7

export interface EventSlotsBlockProps {
  cleanupId: string
  slots: readonly EventSlotDTO[]
  /** Whether the viewer has RSVP'd. Drives the "claiming also RSVPs you" hint (interactive mode only). */
  joined: boolean
  /** DONE / cancelled event: counts only, no pills, no taps. */
  readonly?: boolean
}

/** Minimal translator shape (the `t` from `useT`) for the row's copy helpers. */
type Translate = (key: string, options?: Record<string, unknown>) => string

/**
 * The row's capacity/status line, or null when the state has nothing to say about counts.
 *
 * `open`/`switch` prefer the concrete "N spots left" over the vaguer "Open" - a number is what decides
 * whether someone claims now or later - and fall back to "Open" only for an UNLIMITED slot.
 */
function capacityLine(slot: EventSlotDTO, state: SlotRowState, t: Translate): string | null {
  switch (state) {
    case "mine":
      return t("row.you_claimed")
    case "full":
      return t("row.full_sub")
    case "readonly":
      return t("row.claimed_count", { count: slot.claimed })
    default: {
      const remaining = slotRemaining(slot)
      return remaining === null ? t("row.open") : t("row.remaining", { count: remaining })
    }
  }
}

function MetaLine({ parts }: { parts: readonly string[] }) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <View style={styles.subRow}>
      {parts.map((part, index) => (
        <React.Fragment key={part}>
          {index > 0 ? <MetaDot color={th.colors.textSubtle} /> : null}
          <Text style={index === 0 ? styles.sub : styles.subMeta} numberOfLines={1}>
            {part}
          </Text>
        </React.Fragment>
      ))}
    </View>
  )
}

function SlotRow({
  slot,
  state,
  busy,
  pending,
  mixedBoard,
  onPress,
}: {
  slot: EventSlotDTO
  state: SlotRowState
  /**
   * ANY claim is in flight, so EVERY row's pill is disabled. The viewer's slot is a singular resource:
   * two overlapping PUTs resolve last-RESPONSE-wins, not last-request, so the cache can end up marking a
   * slot the server does not hold. Disabling only the tapped row left that race one tap wide.
   */
  busy: boolean
  /** THIS row is the one in flight - the dim and the a11y busy state, so only the tapped pill reacts. */
  pending: boolean
  mixedBoard: boolean
  /** Claim / switch / release. Absent for the two non-interactive states. */
  onPress?: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-slots")
  const { locale } = useLocale()
  const mine = state === "mine"
  // OWNERSHIP vs INTERACTIVITY. A DONE event renders `readonly`, but the viewer who worked that slot
  // should still see it marked as theirs - so the moss tile/fill keys off `slot.mine`, while the pill and
  // the pop spring key off the interactive `mine` state (readonly has neither).
  const owned = mine || slot.mine === true
  // The cfPop confirmation spring, shared verbatim with RsvpPill: it plays once when this row becomes the
  // viewer's (false -> true), never on release, never on web, never under reduce-motion.
  const popScale = usePopScale(mine)

  const line = capacityLine(slot, state, t)
  const description = slot.description?.trim() ?? ""
  const hasDescription = description.length > 0
  const window = slotWindow(slot)
  const range =
    window === null ? null : timeRangeLabel(window.start.toISOString(), window.end.toISOString(), locale)
  const windowText = range ?? (mixedBoard ? t("row.any_time") : null)
  const metaParts = [windowText, line].filter((part): part is string => part !== null)

  const tile = (
    <View style={[styles.tile, owned ? styles.tileMine : null]}>
      <Icon
        icon={owned ? iconMap.Check : state === "full" ? iconMap.Users : iconMap.ClipboardList}
        size={16}
        color={
          owned
            ? th.colors.moss["700"]
            : state === "full"
              ? th.colors.textSubtle
              : th.colors.textMuted
        }
      />
    </View>
  )

  let pill: React.ReactNode = null
  if (state === "open" || state === "switch") {
    const switching = state === "switch"
    pill = (
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ busy: pending }}
        accessibilityLabel={t(switching ? "row.switch_a11y" : "row.claim_a11y", { title: slot.title })}
        // 30pt visual, 44pt effective target: this pill IS the whole tap area (the row is deliberately
        // not pressable), so the house 44pt rule is met with slop rather than a taller wrapper, which
        // would grow every slot row. 7 on each edge takes the 30pt height to 44.
        hitSlop={PILL_HIT_SLOP}
        {...focusRingProps}
        style={({ pressed }) => [
          styles.pill,
          switching ? styles.pillSwitch : styles.pillClaim,
          webCursorPointer,
          webTransition,
          pressed || pending ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.pillText, switching ? styles.pillSwitchText : styles.pillClaimText]}>
          {t(switching ? "row.switch" : "row.claim")}
        </Text>
      </Pressable>
    )
  } else if (mine) {
    pill = (
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ selected: true, busy: pending }}
        accessibilityLabel={t("row.release_a11y", { title: slot.title })}
        // Same 30pt visual / 44pt target as the claim pill above.
        hitSlop={PILL_HIT_SLOP}
        {...focusRingProps}
        style={({ pressed }) => [
          styles.pill,
          styles.pillMine,
          webCursorPointer,
          webTransition,
          pressed || pending ? styles.pressed : null,
        ]}
      >
        <Icon icon={iconMap.Check} size={14} color={th.colors.moss["700"]} />
        <Text style={[styles.pillText, styles.pillMineText]}>{t("row.claimed")}</Text>
      </Pressable>
    )
  } else if (state === "full") {
    pill = (
      <View style={styles.fullChip}>
        <Text style={styles.fullChipText}>{t("row.full")}</Text>
      </View>
    )
  }

  return (
    <View
      style={[
        styles.row,
        owned ? styles.rowMine : null,
        state === "full" ? styles.rowFull : null,
      ]}
    >
      {POP_ENABLED ? (
        <Animated.View style={{ transform: [{ scale: popScale }] }}>{tile}</Animated.View>
      ) : (
        tile
      )}

      <View
        style={styles.meta}
        {...(range ? { accessibilityRole: "text" as const, accessibilityLabel: t("row.window_a11y", { title: slot.title, range }) } : {})}
      >
        <Text style={styles.title} numberOfLines={1}>
          {slot.title}
        </Text>
        {hasDescription ? (
          <Text style={styles.sub} numberOfLines={metaParts.length > 0 ? 1 : 2}>
            {description}
          </Text>
        ) : null}
        {metaParts.length > 0 ? <MetaLine parts={metaParts} /> : null}
      </View>

      {pill ? (
        POP_ENABLED ? (
          <Animated.View style={{ transform: [{ scale: popScale }] }}>{pill}</Animated.View>
        ) : (
          pill
        )
      ) : null}
    </View>
  )
}

export function EventSlotsBlock({ cleanupId, slots, joined, readonly = false }: EventSlotsBlockProps) {
  const styles = useStyles()
  const { t } = useT("event-slots")
  const qc = useQueryClient()
  const toast = useToast()
  const requireAuth = useRequireAuth()
  const claim = useClaimEventSlot(cleanupId)
  // WHICH row is in flight, so only the tapped pill dims. It is NOT the disabled gate: the mutation is
  // shared by every row, so every row disables on `claim.isPending` (see SlotRow's `busy`).
  const [pendingSlotId, setPendingSlotId] = useState<string | null>(null)

  const onError = useCallback(
    (err: unknown) => {
      setPendingSlotId(null)
      if (appErrorCode(err) === "CONFLICT") {
        // Someone else took the last spot between the read and the tap. Re-read the event so the counts
        // (and this row's state) catch up to what the server just told us - under EVERY key the detail
        // may render as (the page can be cached by refcode when opened from a share link).
        toast.show(t("error.full"), { variant: "error" })
        void qc.invalidateQueries(cleanupDetailFilters(cleanupId))
        return
      }
      toast.show(t("error.generic"), { variant: "error" })
    },
    [cleanupId, qc, t, toast],
  )

  const run = useCallback(
    (slotId: string | null, tappedId: string) => {
      // Belt to the disabled pills' braces: `disabled` is a render-time guard, so a tap already in the
      // gesture queue (or a host that re-fires onPress) could still re-enter here mid-flight and start a
      // second PUT of the same singular resource.
      if (claim.isPending) return
      requireAuth(
        () => {
          setPendingSlotId(tappedId)
          claim.mutate(
            { slotId },
            {
              onSuccess: () => {
                setPendingSlotId(null)
                // Releasing needs no confirmation and no announcement - the row flips back visibly. A
                // CLAIM is worth confirming: on web there is no pop spring to carry it.
                if (slotId !== null) toast.show(t("toast.claimed"))
              },
              onError,
            },
          )
        },
        { next: `/cleanups/${cleanupId}` },
      )
    },
    [claim, cleanupId, onError, requireAuth, t, toast],
  )

  const mine = mySlotId(slots)
  const ordered = slotDisplayOrder(slots)
  const mixedBoard = boardHasTimedSlots(slots)
  // The block's one-line summary. `capacity` is null when ANY slot is unlimited - the model refuses to sum
  // a mix, and there is nothing honest to print for one, so the line is simply omitted then (as it is for
  // a block with no capped spots at all).
  const filled = slotsFilledSummary(slots)

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>{t("block.heading")}</Text>
        {filled.capacity !== null && filled.capacity > 0 ? (
          <Text style={styles.filled} numberOfLines={1}>
            {t("block.filled", { claimed: filled.claimed, capacity: filled.capacity })}
          </Text>
        ) : null}
      </View>
      {!joined && !readonly ? <Text style={styles.hint}>{t("block.claim_joins_hint")}</Text> : null}
      {!joined && !readonly && mixedBoard ? (
        <Text style={styles.hint}>{t("block.no_slot_hint")}</Text>
      ) : null}
      <View style={styles.rows}>
        {ordered.map((slot) => {
          const state = slotRowState(slot, mine, readonly)
          const interactive = state === "open" || state === "switch" || state === "mine"
          return (
            <SlotRow
              key={slot.id}
              slot={slot}
              state={state}
              busy={claim.isPending}
              pending={pendingSlotId === slot.id}
              mixedBoard={mixedBoard}
              {...(interactive
                ? { onPress: () => run(state === "mine" ? null : slot.id, slot.id) }
                : {})}
            />
          )
        })}
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  block: {
    marginTop: t.space["4"],
  },
  // The eyebrow row: heading left, the filled summary right. The row owns the bottom margin the eyebrow
  // used to carry, so the spacing above the hint / rows is unchanged.
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.space["2"],
    marginBottom: t.space["2"],
  },
  // The shared section-eyebrow recipe (EventDetailBody's `bringHead` / `linkedHead`).
  eyebrow: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: t.colors.textSubtle,
  },
  filled: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11,
    color: t.colors.textSubtle,
  },
  hint: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textSubtle,
    marginBottom: t.space["2"],
  },
  rows: {
    gap: t.space["2"],
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    padding: t.space["3"],
    borderRadius: t.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  rowMine: {
    backgroundColor: t.colors.moss["50"],
    borderWidth: 1.5,
    borderColor: t.colors.moss["100"],
  },
  rowFull: {
    backgroundColor: t.colors.bgAlt,
    borderColor: "transparent",
  },

  tile: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
  },
  tileMine: {
    backgroundColor: t.colors.moss["50"],
  },

  meta: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14,
    color: t.colors.text,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  sub: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textMuted,
  },
  subMeta: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textSubtle,
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    flexShrink: 0,
    height: 30,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
  },
  pillClaim: {
    backgroundColor: t.colors.brand.bloom,
  },
  pillSwitch: {
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  pillMine: {
    backgroundColor: t.colors.moss["50"],
  },
  pillText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 12,
  },
  pillClaimText: {
    color: t.colors.onAccent,
  },
  pillSwitchText: {
    color: t.colors.text,
  },
  pillMineText: {
    color: t.colors.moss["700"],
  },

  fullChip: {
    flexShrink: 0,
    height: 30,
    justifyContent: "center",
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
  },
  fullChipText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12,
    color: t.colors.textSubtle,
  },

  pressed: {
    opacity: 0.85,
  },
}))
