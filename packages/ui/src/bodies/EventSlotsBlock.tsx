/**
 * The attendee-facing signup-slot board, the event page's primary commitment surface: one row per slot
 * (`EventSlotRow`), and the trailing pill claims, switches or releases.
 *
 * The viewer's slot is a SINGULAR resource (`PUT /cleanups/:id/slot`), so claim, switch and release are
 * all `useClaimEventSlot(cleanupId)`: `{ slotId }` claims or moves, `{ slotId: null }` releases. Claiming
 * also auto-RSVPs a non-member in the same server transaction, which is why holding a slot is what "going"
 * means here.
 *
 * Ownership comes off the server's `slot.mine`, never the roster: the roster decides who is LISTED, the
 * DTO decides which row is YOURS.
 *
 * No `Modal`, `FlatList` or inner `ScrollView`: the expansion grows the card inside the page's existing
 * scroller (the same constraint as `SlotEditor`).
 */
import React, { useCallback, useMemo, useRef, useState } from "react"
import { View, LayoutAnimation, Platform } from "react-native"
import { useQueryClient } from "@tanstack/react-query"
import type { AttendeeDTO, EventSlotDTO } from "@civfix/shared"
import { headingLevel, makeThemedStyles, useTheme, useReducedMotion } from "../theme"
import { Text, Icon, iconMap, TextLink } from "../typography"
import { MetaDot, useToast } from "../primitives"
import {
  cleanupDetailFilters,
  useAuthState,
  useClaimEventSlot,
  useCleanupAttendees,
  useJoinCleanup,
  useRequireAuth,
} from "../data"
import { useLocale, useT } from "../i18n"
import { appErrorCode, appErrorFields } from "../data/errorCode"
import { claimantsBySlot, groupRosterBySlot } from "./rosterSlotGroups"
import { slotPeopleView } from "./slotPeopleVisibility"
import {
  boardHasTimedSlots,
  claimSlotErrorKey,
  mySlotId,
  slotBoardSummary,
  slotDisplayOrder,
  slotRowState,
  slotViewerState,
  slotWindowRangeLabel,
  type SlotViewerState,
} from "./eventSlotsModel"
import { SlotRow } from "./EventSlotRow"

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

function ViewerStrip({
  viewerState,
  heldSlot,
  cancelled,
  ticketed,
  viewer,
  timeZone,
}: {
  viewerState: SlotViewerState
  heldSlot: EventSlotDTO | null
  cancelled: boolean
  ticketed: boolean
  viewer: EventSlotsBlockProps["viewer"]
  timeZone: string | undefined
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-slots")
  const { locale } = useLocale()
  const heldRange = slotWindowRangeLabel(heldSlot, locale, timeZone)

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
  const { t } = useT("event-slots")
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
    return claimantsBySlot(groupRosterBySlot(roster, slots, { unassignedTitle: t("roster.unassigned") }))
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
      <ViewerStrip
        viewerState={viewerState}
        heldSlot={heldSlot}
        cancelled={cancelled}
        ticketed={ticketed}
        viewer={viewer}
        timeZone={timeZone}
      />
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
    fontSize: t.fontSize["12"],
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
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },

  rows: {
    gap: t.space["2"],
  },
  guestLine: {
    marginTop: t.space["3"],
  },
}))
