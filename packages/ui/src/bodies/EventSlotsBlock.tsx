/**
 * The attendee-facing signup-slot board, the event page's primary commitment surface: one row per slot,
 * and the trailing pill claims, switches or releases.
 *
 * The viewer's slot is a SINGULAR resource (`PUT /cleanups/:id/slot`), so claim, switch and release are
 * all `useClaimEventSlot(cleanupId)`: `{ slotId }` claims or moves, `{ slotId: null }` releases. Claiming
 * also auto-RSVPs a non-member in the same server transaction, which is why holding a slot is what "going"
 * means here.
 *
 * The disclosure is a sibling of the pill, never its parent: react-native-web renders `Pressable` as a
 * `<button>`, and a nested button is invalid DOM the browser silently re-parents. Ownership comes off the
 * server's `slot.mine`, never the roster: the roster decides who is LISTED, the DTO decides which row is
 * YOURS.
 *
 * No `Modal`, `FlatList` or inner `ScrollView`: the expansion grows the card inside the page's existing
 * scroller (the same constraint as `SlotEditor`).
 */
import React, { useCallback, useMemo, useRef, useState } from "react"
import { View, Pressable, StyleSheet, Animated, LayoutAnimation, Platform } from "react-native"
import { useQueryClient } from "@tanstack/react-query"
import type { AttendeeDTO, EventSlotDTO } from "@civfix/shared"
import { timeRangeLabel } from "@civfix/shared/datetime"
import {
  headingLevel,
  makeThemedStyles,
  useTheme,
  useReducedMotion,
  webCursorPointer,
  webHover,
  webTransition,
  focusRingProps,
} from "../theme"
import { Text, Icon, iconMap, TextLink } from "../typography"
import { Avatar, MetaDot, SkeletonList, useToast } from "../primitives"
import { POP_ENABLED, usePopScale } from "../primitives/usePopScale"
import {
  cleanupDetailFilters,
  useAuthState,
  useClaimEventSlot,
  useCleanupAttendees,
  useJoinCleanup,
  useRequireAuth,
} from "../data"
import { useNavStore } from "../nav"
import { useLocale, useT } from "../i18n"
import { appErrorCode, appErrorFields } from "./errorCode"
import { FeedNotice } from "./FeedNotice"
import { RoleChip } from "./RoleChip"
import { claimantsBySlot, groupRosterBySlot } from "./rosterSlotGroups"
import {
  FACE_NAME_CAP,
  facePileOverflow,
  slotPeopleView,
  type SlotPeopleView,
} from "./slotPeopleVisibility"
import {
  boardHasTimedSlots,
  claimSlotErrorKey,
  mySlotId,
  slotBoardSummary,
  slotDisplayOrder,
  slotRemaining,
  slotRowState,
  slotViewerState,
  slotWindow,
  type SlotRowState,
} from "./eventSlotsModel"

/**
 * Vertical slop that turns the 30pt pill into a 44pt effective target (30 + 7 + 7). Applied on all four
 * edges: the horizontal padding already clears 44 for every label, and symmetric slop stays inside the
 * row's own 12pt padding, so no row's slop can reach into its neighbour's.
 */
const PILL_HIT_SLOP = 7

/** Faces in the collapsed preview. Past three the row is a wall of circles, and the count says the rest. */
const FACE_CAP = 3

const NO_ATTENDEES: readonly AttendeeDTO[] = []
const NOTHING_OPEN: ReadonlySet<string> = new Set<string>()

export interface EventSlotsBlockProps {
  cleanupId: string
  slots: readonly EventSlotDTO[]
  /** Whether the viewer has joined. Drives the viewer strip, not any row's state. */
  joined: boolean
  /** DONE / cancelled event: counts only, no pills, no taps. */
  readonly?: boolean
  /** Cancelled events say so in the header already, so the board stays silent above the rows. */
  cancelled?: boolean
  /** The EVENT's IANA zone; shift windows render in it. Absent (legacy row) = the viewer's zone. */
  timeZone?: string
  /**
   * `registration` - a ticketed event commits through `RegistrationBlock`, so the board offers no second
   * primary CTA to a viewer who has not registered. `general` - the slot-less fallback: `slots` carries
   * the single synthetic row `generalSlotBoard` builds, and its pill commits through the event's
   * join/leave mutation rather than a slot claim, because that row IS membership.
   */
  mode: "claim" | "registration" | "general"
  viewer: { actsAsHost: boolean; registered: boolean }
  /** Opens the host's guest-RSVP sheet. Absent when the host cannot mint a Turnstile token. */
  onGuestRsvp?: () => void
  onViewAll: () => void
}

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

function windowRangeLabel(
  slot: EventSlotDTO | null,
  locale: string,
  timeZone: string | undefined,
): string | null {
  if (slot === null) return null
  const window = slotWindow(slot)
  if (window === null) return null
  return timeRangeLabel(window.start.toISOString(), window.end.toISOString(), locale, timeZone)
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

function SlotRow({
  slot,
  state,
  busy,
  pending,
  mixedBoard,
  timeZone,
  showPill,
  expanded,
  people,
  view,
  peopleLoading,
  peopleErrored,
  nudgeToSignUp,
  viewerId,
  hostLabel,
  onToggle,
  onRetryPeople,
  onViewAll,
  onPress,
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
  view: SlotPeopleView
  peopleLoading: boolean
  peopleErrored: boolean
  nudgeToSignUp: boolean
  viewerId: string | null
  hostLabel: string
  onToggle: () => void
  onRetryPeople: () => void
  onViewAll: () => void
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
  const range = windowRangeLabel(slot, locale, timeZone)
  const windowText = range ?? (mixedBoard ? t("row.any_time") : null)
  const metaParts = [windowText, line].filter((part): part is string => part !== null)
  const faces = people.slice(0, FACE_CAP)
  const previewNames = people
    .slice(0, FACE_NAME_CAP)
    .map((person) => firstNameOf(personLabel(person, viewerId, t)))
    .join(", ")
  const previewOverflow = facePileOverflow(slot.claimed, people.length)

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
  if (!showPill) {
    pill = null
  } else if (state === "open" || state === "switch") {
    const switching = state === "switch"
    pill = (
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
          onPress={onToggle}
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
            {!expanded && faces.length > 0 ? (
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
}

export function EventSlotsBlock({
  cleanupId,
  slots,
  joined,
  readonly = false,
  cancelled = false,
  timeZone,
  mode,
  viewer,
  onGuestRsvp,
  onViewAll,
}: EventSlotsBlockProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-slots")
  const { locale } = useLocale()
  const qc = useQueryClient()
  const toast = useToast()
  const requireAuth = useRequireAuth()
  const claim = useClaimEventSlot(cleanupId)
  const join = useJoinCleanup(cleanupId)
  const attendees = useCleanupAttendees(cleanupId)
  const { user, isAuthenticated, isPending } = useAuthState()
  const reducedMotion = useReducedMotion()
  // WHICH row is in flight, so only the tapped pill dims. It is NOT the disabled gate: the mutation is
  // shared by every row, so every row disables on `boardBusy` (see SlotRow's `busy`).
  const [pendingSlotId, setPendingSlotId] = useState<string | null>(null)
  const [open, setOpen] = useState<ReadonlySet<string>>(NOTHING_OPEN)
  const ticketed = mode === "registration"
  const general = mode === "general"
  const boardBusy = general ? join.isPending : claim.isPending
  // `boardBusy` is the value of the last render, so two taps inside one frame both read it as false.
  const inFlight = useRef(false)

  const onError = useCallback(
    (err: unknown) => {
      setPendingSlotId(null)
      const code = appErrorCode(err)
      toast.show(t(claimSlotErrorKey(code, appErrorFields(err))), { variant: "error" })
      // A 409 means the server's board moved under this tap - the last spot went, or the event ended.
      // Re-read the event under EVERY key the detail may render as (the page can be cached by refcode
      // when opened from a share link) so the counts and this block's readonly state catch up.
      if (code === "CONFLICT") void qc.invalidateQueries(cleanupDetailFilters(cleanupId))
    },
    [cleanupId, qc, t, toast],
  )

  const run = useCallback(
    (slotId: string | null, tappedId: string, title: string) => {
      // Belt to the disabled pills' braces: `disabled` is a render-time guard, so a tap already in the
      // gesture queue (or a host that re-fires onPress) could still re-enter here mid-flight and start a
      // second PUT of the same singular resource.
      if (boardBusy) return
      if (inFlight.current) return
      requireAuth(
        () => {
          if (inFlight.current) return
          inFlight.current = true
          const settle = () => {
            inFlight.current = false
          }
          setPendingSlotId(tappedId)
          if (general) {
            join.mutate(slotId === null, {
              onSettled: settle,
              onSuccess: () => {
                setPendingSlotId(null)
                if (slotId === null) return
                toast.show(t("toast.claimed"))
              },
              onError: () => setPendingSlotId(null),
            })
            return
          }
          const switching = slotId !== null && mySlotId(slots) !== null
          claim.mutate(
            { slotId },
            {
              onSettled: settle,
              onSuccess: () => {
                setPendingSlotId(null)
                // Releasing needs no confirmation and no announcement - the row flips back visibly. A
                // CLAIM is worth confirming: on web there is no pop spring to carry it, and a SWITCH
                // has to name where you landed or two moss rows read the same for a frame.
                if (slotId === null) return
                toast.show(switching ? t("toast.switched", { title }) : t("toast.claimed"))
              },
              onError,
            },
          )
        },
        { next: `/cleanups/${cleanupId}` },
      )
    },
    [boardBusy, claim, cleanupId, general, join, onError, requireAuth, slots, t, toast],
  )

  const onToggle = useCallback(
    (slotId: string) => {
      if (Platform.OS === "ios" && reducedMotion !== true) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      }
      setOpen((prev) => {
        const next = new Set(prev)
        if (next.has(slotId)) next.delete(slotId)
        else next.add(slotId)
        return next
      })
    },
    [reducedMotion],
  )

  const onRetryPeople = useCallback(() => {
    void attendees.refetch()
  }, [attendees])

  const mine = mySlotId(slots)
  const ordered = slotDisplayOrder(slots)
  const mixedBoard = boardHasTimedSlots(slots)
  const summary = slotBoardSummary(slots)
  const heldSlot = slots.find((slot) => slot.mine === true) ?? null

  const claimants = useMemo(() => {
    const roster = attendees.data?.attendees ?? NO_ATTENDEES
    if (general) {
      const only = slots[0]
      return only ? new Map([[only.id, [...roster]]]) : new Map<string, AttendeeDTO[]>()
    }
    return claimantsBySlot(
      groupRosterBySlot(roster, slots, {
        unassignedTitle: t("roster.unassigned"),
        emptySlotTitle: t("roster.empty_slot"),
      }),
    )
  }, [attendees.data, general, slots, t])

  const viewerState = slotViewerState({
    slots,
    joined,
    actsAsHost: viewer.actsAsHost,
    readonly,
    isAuthenticated,
    authPending: isPending,
  })
  const peopleLoading = attendees.isLoading && attendees.data === undefined
  const peopleErrored = attendees.isError && attendees.data === undefined
  const showPill = !ticketed || viewer.registered || viewer.actsAsHost
  const canSignUpHere =
    showPill && (viewerState === "not_going" || viewerState === "signed_out")
  const hostLabel = t("event-members:role.host")

  const heldRange = windowRangeLabel(heldSlot, locale, timeZone)

  function renderStrip(): React.ReactNode {
    if (viewerState === "host") return null
    if (viewerState === "ended") {
      if (heldSlot === null || cancelled) return null
      return (
        <View style={[styles.strip, styles.stripMuted]}>
          <Icon icon={iconMap.Check} size={16} color={th.colors.textMuted} />
          <Text style={[styles.stripText, styles.stripTextMuted]} numberOfLines={2}>
            {t("viewer.held", { slot: heldSlot.title })}
          </Text>
          {heldRange ? (
            <>
              <MetaDot color={th.colors.textSubtle} />
              <Text style={styles.stripMeta}>{heldRange}</Text>
            </>
          ) : null}
        </View>
      )
    }
    if (viewerState === "holds" && heldSlot !== null) {
      return (
        <View style={[styles.strip, styles.stripMoss]}>
          <Icon icon={iconMap.Check} size={16} color={th.colors.moss["700"]} />
          <Text style={[styles.stripText, styles.stripTextMoss]} numberOfLines={2}>
            {t("viewer.holds", { slot: heldSlot.title })}
          </Text>
          {heldRange ? (
            <>
              <MetaDot color={th.colors.textSubtle} />
              <Text style={styles.stripMeta}>{heldRange}</Text>
            </>
          ) : null}
        </View>
      )
    }
    if (viewerState === "going_no_slot" && (!ticketed || viewer.registered)) {
      return (
        <View style={[styles.strip, styles.stripSun]}>
          <Icon icon={iconMap.ClipboardList} size={16} color={th.colors.sun["700"]} />
          <Text style={[styles.stripText, styles.stripTextSun]}>{t("viewer.going_no_slot")}</Text>
        </View>
      )
    }
    if (ticketed) return <Text style={styles.hint}>{t("viewer.ticketed_hint")}</Text>
    return <Text style={styles.hint}>{t("viewer.pick_hint")}</Text>
  }

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Text style={styles.eyebrow} accessibilityRole="header" {...headingLevel(3)}>
          {t("block.heading")}
        </Text>
        <Text style={styles.filled} numberOfLines={1}>
          {summary.kind === "capped" && summary.capacity !== null && summary.capacity > 0
            ? t("block.filled", { claimed: summary.claimed, capacity: summary.capacity })
            : summary.claimed > 0
              ? t("block.signed_up", { count: summary.claimed })
              : t("block.none_signed_up")}
        </Text>
      </View>
      {renderStrip()}
      <View style={styles.rows}>
        {ordered.map((slot) => {
          const state = slotRowState(slot, mine, readonly)
          const interactive =
            showPill && (state === "open" || state === "switch" || state === "mine")
          const people = claimants.get(slot.id) ?? NO_ATTENDEES
          const view = slotPeopleView({
            scope: attendees.data?.scope,
            claimed: slot.claimed,
            shown: people.length,
          })
          return (
            <SlotRow
              key={slot.id}
              slot={slot}
              state={state}
              busy={boardBusy}
              pending={pendingSlotId === slot.id}
              mixedBoard={mixedBoard}
              timeZone={timeZone}
              showPill={showPill}
              expanded={open.has(slot.id)}
              people={people}
              view={view}
              peopleLoading={peopleLoading}
              peopleErrored={peopleErrored}
              nudgeToSignUp={canSignUpHere && state === "open"}
              viewerId={user?.id ?? null}
              hostLabel={hostLabel}
              onToggle={() => onToggle(slot.id)}
              onRetryPeople={onRetryPeople}
              onViewAll={onViewAll}
              {...(interactive
                ? { onPress: () => run(state === "mine" ? null : slot.id, slot.id, slot.title) }
                : {})}
            />
          )
        })}
      </View>
      {viewerState === "signed_out" && onGuestRsvp && !ticketed ? (
        <View style={styles.guestLine}>
          <TextLink
            variant="label"
            onPress={onGuestRsvp}
            standalone
            accessibilityLabel={t("viewer.guest_link_a11y")}
          >
            {t("viewer.guest_link")}
          </TextLink>
        </View>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  block: {
    marginTop: t.space["4"],
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.space["2"],
    marginBottom: t.space["2"],
  },
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

  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    padding: t.space["3"],
    borderRadius: t.radius.md,
    marginBottom: t.space["3"],
  },
  stripMoss: {
    backgroundColor: t.colors.moss["50"],
  },
  stripSun: {
    backgroundColor: t.colors.sun["50"],
  },
  stripMuted: {
    backgroundColor: t.colors.bgAlt,
  },
  stripText: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.text,
  },
  stripTextMoss: {
    color: t.colors.moss["700"],
  },
  stripTextSun: {
    color: t.colors.sun["700"],
  },
  stripTextMuted: {
    color: t.colors.textMuted,
  },
  stripMeta: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textSubtle,
  },

  rows: {
    gap: t.space["2"],
  },
  guestLine: {
    marginTop: t.space["3"],
  },

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
    gap: 2,
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
    fontSize: 12,
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
    fontSize: 12,
    color: t.colors.textSubtle,
  },
  personRow: {
    minHeight: 40,
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
    fontSize: 12,
    color: t.colors.textSubtle,
  },

  pillWrap: {
    alignSelf: "flex-start",
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
