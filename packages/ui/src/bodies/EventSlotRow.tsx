/**
 * One row of the attendee-facing slot board (`EventSlotsBlock`): the disclosure that expands the slot's
 * people, and beside it the trailing pill that claims, switches or releases.
 *
 * The disclosure is a sibling of the pill, never its parent: react-native-web renders `Pressable` as a
 * `<button>`, and a nested button is invalid DOM the browser silently re-parents.
 */
import React, { memo, useCallback } from "react"
import { View, Pressable, StyleSheet, Animated } from "react-native"
import type { AttendeeDTO, CleanupAttendeesResponse, EventSlotDTO } from "@civfix/shared"
import {
  makeThemedStyles,
  useTheme,
  webCursorPointer,
  webHover,
  webTransition,
  focusRingProps,
} from "../theme"
import { Text, Icon, iconMap, TextLink } from "../typography"
import { Avatar, MetaDot, SkeletonList } from "../primitives"
import { POP_ENABLED, usePopScale } from "../primitives/usePopScale"
import { useNavStore } from "../nav"
import { useLocale, useT } from "../i18n"
import { FeedNotice } from "./FeedNotice"
import { RoleChip } from "./RoleChip"
import { FACE_CAP, FACE_NAME_CAP, facePileOverflow, slotPeopleView, type SlotPeopleView } from "./slotPeopleVisibility"
import { slotRemaining, slotWindowRangeLabel, type SlotRowState } from "./eventSlotsModel"

/**
 * Vertical slop that turns the 30pt pill into a 44pt effective target (30 + 7 + 7). Applied on all four
 * edges: the horizontal padding already clears 44 for every label, and symmetric slop stays inside the
 * row's own 12pt padding, so no row's slop can reach into its neighbour's.
 */
const PILL_HIT_SLOP = 7

const SLOT_TILE_SIZE = 34

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

/** The label a facepile prints for one claimant. "You" wins over a real name for the viewer's own row. */
function personLabel(person: AttendeeDTO, viewerId: string | null, t: Translate): string {
  if (viewerId !== null && person.id === viewerId) return t("people.you")
  return person.name
}

function firstNameOf(label: string): string {
  const trimmed = label.trim()
  const cut = trimmed.indexOf(" ")
  return cut > 0 ? trimmed.slice(0, cut) : trimmed
}

/**
 * The viewer's own row first, everyone else in server order. A stable PARTITION, not a sort: the server's
 * ordering is meaningful (claim time) and re-sorting the whole list to lift one row would destroy it.
 */
function viewerFirst(people: readonly AttendeeDTO[], viewerId: string | null): AttendeeDTO[] {
  if (viewerId === null) return [...people]
  const mine = people.filter((p) => p.id === viewerId)
  if (mine.length === 0) return [...people]
  return [...mine, ...people.filter((p) => p.id !== viewerId)]
}

function MetaLine({ parts, trailing }: { parts: readonly string[]; trailing?: React.ReactNode }) {
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
      {trailing}
    </View>
  )
}

function PersonRow({ person, label, hostLabel }: { person: AttendeeDTO; label: string; hostLabel: string | null }) {
  const styles = useStyles()
  const { t } = useT("event-slots")
  const onPress = useCallback(() => {
    useNavStore.getState().push({ kind: "person", id: person.handle ?? person.id })
  }, [person.handle, person.id])

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("people.view_profile_a11y", { name: person.name })}
      {...focusRingProps}
      style={(state) => [
        styles.personRow,
        webCursorPointer,
        webTransition,
        webHover(state) ? styles.personRowHovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      <Avatar
        name={person.name}
        seed={person.id}
        photoUrl={person.avatarUrl ?? null}
        gradient={person.avatar ?? null}
        size={28}
        decorative
      />
      <View style={styles.personMeta}>
        <Text style={styles.personName} numberOfLines={1}>
          {label}
        </Text>
        {person.handle ? (
          <Text style={styles.personHandle} numberOfLines={1}>
            @{person.handle}
          </Text>
        ) : null}
      </View>
      {hostLabel ? <RoleChip label={hostLabel} tone="lead" /> : null}
    </Pressable>
  )
}

function SlotPeople({
  people,
  view,
  loading,
  errored,
  nudgeToSignUp,
  viewerId,
  hostLabel,
  onRetry,
  onViewAll,
}: {
  people: readonly AttendeeDTO[]
  view: SlotPeopleView
  loading: boolean
  errored: boolean
  /** An open row the viewer could still take: worth one line of encouragement, never on a past row. */
  nudgeToSignUp: boolean
  viewerId: string | null
  hostLabel: string
  onRetry: () => void
  onViewAll: () => void
}) {
  const styles = useStyles()
  const { t } = useT("event-slots")

  if (loading) return <SkeletonList rows={2} kind="person" />
  if (errored) {
    return (
      <>
        <Text style={styles.peopleState}>{t("people.error")}</Text>
        <TextLink variant="label" onPress={onRetry} standalone>
          {t("people.retry")}
        </TextLink>
      </>
    )
  }
  if (view.shown === 0 && view.claimed === 0) {
    return (
      <>
        <Text style={styles.peopleState}>{t("roster.empty_slot")}</Text>
        {nudgeToSignUp ? <Text style={styles.peopleState}>{t("people.be_first")}</Text> : null}
      </>
    )
  }
  if (view.shown === 0) {
    return view.showGate ? (
      <FeedNotice
        plain
        icon="Lock"
        title={t("people.gated_title")}
        body={t("people.gated_empty", { count: view.claimed })}
      />
    ) : (
      <>
        <Text style={styles.peopleState}>
          {t("people.partial", { shown: 0, claimed: view.claimed })}
        </Text>
        <TextLink
          variant="label"
          onPress={onViewAll}
          standalone
          accessibilityLabel={t("people.more_a11y")}
        >
          {t("people.more", { count: view.hidden })}
        </TextLink>
      </>
    )
  }

  const ordered = viewerFirst(people, viewerId)
  return (
    <>
      {ordered.map((person) => (
        <PersonRow
          key={person.id}
          person={person}
          label={personLabel(person, viewerId, t)}
          hostLabel={person.role === "organizer" || person.role === "cohost" ? hostLabel : null}
        />
      ))}
      {view.hidden > 0 && view.access === "full" ? (
        <TextLink
          variant="label"
          onPress={onViewAll}
          standalone
          accessibilityLabel={t("people.more_a11y")}
        >
          {t("people.more", { count: view.hidden })}
        </TextLink>
      ) : null}
      {view.showGate ? (
        <>
          <Text style={styles.peopleState}>
            {t("people.partial", { shown: view.shown, claimed: view.claimed })}
          </Text>
          <FeedNotice
            plain
            icon="Lock"
            title={t("people.gated_title")}
            body={t("people.gated_hint")}
          />
        </>
      ) : null}
    </>
  )
}

function SlotTile({ owned, state }: { owned: boolean; state: SlotRowState }) {
  const styles = useStyles()
  const th = useTheme()
  return (
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
}

function SlotPill({
  slot,
  state,
  busy,
  pending,
  onPress,
}: {
  slot: EventSlotDTO
  state: Exclude<SlotRowState, "readonly">
  busy: boolean
  pending: boolean
  onPress: (() => void) | undefined
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-slots")

  if (state === "open" || state === "switch") {
    const switching = state === "switch"
    return (
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ busy: pending }}
        accessibilityLabel={t(switching ? "row.switch_a11y" : "row.claim_a11y", { title: slot.title })}
        // This pill is the row's commitment action and the page's primary one, so the 44pt rule is met
        // with slop rather than a taller wrapper, which would grow every slot row.
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
  }
  if (state === "mine") {
    return (
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
  }
  return (
    <View style={styles.fullChip}>
      <Text style={styles.fullChipText}>{t("row.full")}</Text>
    </View>
  )
}

/** The collapsed row's first faces and first names, with a "+N" counted against what the row prints. */
function SlotFacePreview({
  slot,
  people,
  viewerId,
}: {
  slot: EventSlotDTO
  people: readonly AttendeeDTO[]
  viewerId: string | null
}) {
  const styles = useStyles()
  const { t } = useT("event-slots")
  const faces = people.slice(0, FACE_CAP)
  const previewNames = people
    .slice(0, FACE_NAME_CAP)
    .map((person) => firstNameOf(personLabel(person, viewerId, t)))
    .join(", ")
  const previewOverflow = facePileOverflow(slot.claimed, people.length)

  return (
    <View style={styles.facesRow}>
      {faces.map((person, index) => (
        <View key={person.id} style={index === 0 ? null : styles.faceOverlap}>
          <Avatar
            name={person.name}
            seed={person.id}
            photoUrl={person.avatarUrl ?? null}
            gradient={person.avatar ?? null}
            size={20}
            decorative
          />
        </View>
      ))}
      <Text style={styles.facesNames} numberOfLines={1}>
        {previewOverflow > 0
          ? t("row.faces_names_more", { names: previewNames, count: previewOverflow })
          : previewNames}
      </Text>
    </View>
  )
}

// Memoized with slot-id handlers so a disclosure toggle or a parent re-render repaints only the rows whose
// props changed, not the whole board.
export const SlotRow = memo(function SlotRow({
  slot,
  state,
  busy,
  pending,
  mixedBoard,
  timeZone,
  showPill,
  expanded,
  people,
  peopleScope,
  peopleLoading,
  peopleErrored,
  nudgeToSignUp,
  viewerId,
  hostLabel,
  onToggle,
  onRetryPeople,
  onViewAll,
  onClaim,
}: {
  slot: EventSlotDTO
  state: SlotRowState
  /**
   * ANY claim is in flight, so EVERY row's pill is disabled. The viewer's slot is a singular resource:
   * two overlapping PUTs resolve last-RESPONSE-wins, not last-request, so the cache can end up marking a
   * slot the server does not hold. Disabling only the tapped row would leave that race one tap wide.
   */
  busy: boolean
  /** THIS row is the one in flight - the dim and the a11y busy state, so only the tapped pill reacts. */
  pending: boolean
  mixedBoard: boolean
  timeZone: string | undefined
  /** A ticketed event hides the pill until the viewer has registered; the disclosure stays live. */
  showPill: boolean
  expanded: boolean
  people: readonly AttendeeDTO[]
  peopleScope: CleanupAttendeesResponse["scope"] | undefined
  peopleLoading: boolean
  peopleErrored: boolean
  nudgeToSignUp: boolean
  viewerId: string | null
  hostLabel: string
  onToggle: (slotId: string) => void
  onRetryPeople: () => void
  onViewAll: () => void
  /** Claim / switch / release. Absent for the two non-interactive states. */
  onClaim?: (slotId: string | null, tappedId: string, title: string) => void
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
  const range = slotWindowRangeLabel(slot, locale, timeZone)
  const windowText = range ?? (mixedBoard ? t("row.any_time") : null)
  const metaParts = [windowText, line].filter((part): part is string => part !== null)

  const tile = <SlotTile owned={owned} state={state} />
  const view = slotPeopleView({ scope: peopleScope, claimed: slot.claimed, shown: people.length })
  const onDisclosurePress = () => onToggle(slot.id)
  const onPress = onClaim ? () => onClaim(mine ? null : slot.id, slot.id, slot.title) : undefined
  const pill =
    showPill && state !== "readonly" ? (
      <SlotPill slot={slot} state={state} busy={busy} pending={pending} onPress={onPress} />
    ) : null

  const disclosureLabel = range
    ? t("row.window_count_a11y", { title: slot.title, range, count: slot.claimed })
    : t("row.expand_a11y", { title: slot.title, count: slot.claimed })

  return (
    <View
      style={[
        styles.row,
        owned ? styles.rowMine : null,
        state === "full" ? styles.rowFull : null,
      ]}
    >
      <View style={styles.rowMain}>
        <Pressable
          onPress={onDisclosurePress}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={disclosureLabel}
          accessibilityHint={t(expanded ? "row.collapse_hint" : "row.expand_hint")}
          {...focusRingProps}
          style={(pressState) => [
            styles.disclosure,
            webCursorPointer,
            webTransition,
            webHover(pressState) ? styles.disclosureHovered : null,
            pressState.pressed ? styles.pressed : null,
          ]}
        >
          {POP_ENABLED ? (
            <Animated.View style={{ transform: [{ scale: popScale }] }}>{tile}</Animated.View>
          ) : (
            tile
          )}

          <View style={styles.meta}>
            <Text style={styles.title} numberOfLines={1}>
              {slot.title}
            </Text>
            {hasDescription ? (
              <Text style={styles.sub} numberOfLines={metaParts.length > 0 ? 1 : 2}>
                {description}
              </Text>
            ) : null}
            {metaParts.length > 0 ? (
              <MetaLine
                parts={metaParts}
                trailing={
                  <Icon
                    icon={expanded ? iconMap.ChevronUp : iconMap.ChevronDown}
                    size={14}
                    color={th.colors.textSubtle}
                  />
                }
              />
            ) : null}
            {!expanded && people.length > 0 ? (
              <SlotFacePreview slot={slot} people={people} viewerId={viewerId} />
            ) : null}
          </View>
        </Pressable>

        {pill ? (
          POP_ENABLED ? (
            <Animated.View style={styles.pillWrap}>
              <Animated.View style={{ transform: [{ scale: popScale }] }}>{pill}</Animated.View>
            </Animated.View>
          ) : (
            <View style={styles.pillWrap}>{pill}</View>
          )
        ) : null}
      </View>

      {expanded ? (
        <View style={styles.people}>
          <SlotPeople
            people={people}
            view={view}
            loading={peopleLoading}
            errored={peopleErrored}
            nudgeToSignUp={nudgeToSignUp}
            viewerId={viewerId}
            hostLabel={hostLabel}
            onRetry={onRetryPeople}
            onViewAll={onViewAll}
          />
        </View>
      ) : null}
    </View>
  )
})

const useStyles = makeThemedStyles((t) => ({
  row: {
    padding: t.space["3"],
    borderRadius: t.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  rowMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
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

  disclosure: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  disclosureHovered: {
    backgroundColor: t.colors.surfaceTint,
    marginHorizontal: -t.space["2"],
    paddingHorizontal: t.space["2"],
    borderRadius: t.radius.sm,
  },

  tile: {
    width: SLOT_TILE_SIZE,
    height: SLOT_TILE_SIZE,
    borderRadius: SLOT_TILE_SIZE / 2,
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
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minWidth: 0,
  },
  sub: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
  },
  subMeta: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },

  facesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    marginTop: t.space["1"],
  },
  faceOverlap: {
    marginLeft: -6,
  },
  facesNames: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },

  people: {
    marginTop: t.space["3"],
    paddingTop: t.space["3"],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
    gap: t.space["2"],
  },
  peopleState: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  personRow: {
    minHeight: t.space["10"],
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    borderRadius: t.radius.sm,
  },
  personRowHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  personMeta: {
    flex: 1,
    minWidth: 0,
  },
  personName: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.text,
  },
  personHandle: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },

  pillWrap: {
    alignSelf: "flex-start",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["1"],
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
    fontSize: t.fontSize["12"],
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
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },

  pressed: {
    opacity: 0.85,
  },
}))
