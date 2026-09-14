import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import {
  EVENT_KIND_VALUES,
  MIN_EVENT_DURATION_MINUTES,
  type EventKind,
  type EventSlotDTO,
  type OrganizationRefDTO,
  type PersonDTO,
  type ReportDTO,
} from "@civfix/shared"
import type { LatLng } from "@civfix/shared/geocode"
import {
  makeThemedStyles,
  useTheme,
  useLayoutMode,
  webCursorPointer,
  webTransition,
  webHover,
  focusRingProps,
} from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { TextField, BringInput, MetaDot } from "../primitives"
import { actableOrganizations, useMyOrganizations, useReport, useReverseLabel, reverseLabelText } from "../data"
import { LocationPicker, PortraitMapPickStep, useLocationPick } from "../map"
import { useLocale, useT, viewerTimeZone } from "../i18n"
import { AddressSearch, type AddressPick } from "./AddressSearch"
import { AuthorAsChips, authorAsSelection, type AuthorAsOption } from "./AuthorAsChips"
import { buildEventPreviewCard } from "./feedShare"
import { FeedShareBlock, FeedShareEventCard } from "./FeedShareBlock"
import {
  endOffsetMs,
  endTimeAfter,
  endTimeSelectable,
  formInstantMs,
  mergeDateTime,
  scheduleFieldErrors,
} from "./calendarModel"
import { InlineDateTimePicker } from "./InlineDateTimePicker"
import { TimezoneField } from "./TimezoneField"
import { LinkedReportCard, type LinkedReportCardData } from "./LinkedReportCard"
import { DEFAULT_WIZARD_DURATION_MS, eventDraftWindow } from "./eventWizard"
import { SlotEditor } from "./SlotEditor"
import {
  addSlotDraft,
  claimedBySlotId,
  hasNamedSlot,
  makeSlotKey,
  shiftSlotDrafts,
  slotsValid,
  type SlotDraft,
  type SlotWindowBounds,
} from "./eventSlotsForm"

export interface CleanupFormValue {
  organizationId: string | null
  title: string
  description: string
  eventKind: EventKind
  addrQuery: string
  spot: string
  coords: { lat: number; lng: number } | null
  date: Date | null
  time: Date | null
  endTime: Date | null
  timezone: string
  bring: string[]
  slots: SlotDraft[]
  linkedReportIds: string[]
  shareToFeed: boolean
  feedCaption: string
}

export type CleanupFormSection = "basics" | "when" | "where" | "extras" | "share"

export const ALL_CLEANUP_FORM_SECTIONS: readonly CleanupFormSection[] = [
  "basics",
  "when",
  "where",
  "extras",
  "share",
]

export function emptyCleanupForm(
  seedLinkedReportId?: string,
  seedOrganizationId?: string,
): CleanupFormValue {
  return {
    organizationId: seedOrganizationId ?? null,
    title: "",
    description: "",
    eventKind: "cleanup",
    addrQuery: "",
    spot: "",
    coords: null,
    date: null,
    time: null,
    endTime: null,
    timezone: viewerTimeZone(),
    bring: [],
    slots: addSlotDraft([], makeSlotKey()),
    linkedReportIds: seedLinkedReportId ? [seedLinkedReportId] : [],
    shareToFeed: true,
    feedCaption: "",
  }
}

export { mergeDateTime } from "./calendarModel"

export function cleanupFormWindow(value: CleanupFormValue): SlotWindowBounds | null {
  return eventDraftWindow(value)
}

export function hasValidEventEnd(value: CleanupFormValue): boolean {
  if (!value.date || !value.time || !value.endTime) return false
  return endTimeSelectable(
    value.date,
    value.time,
    value.endTime.getHours(),
    value.endTime.getMinutes(),
    value.timezone,
  )
}

/**
 * The >=1 named sign-up slot floor is unconditional: every event needs a board, the edit route is only
 * ever offered for an event that has not ended, and the server refuses a slot change afterwards anyway.
 */
export function isCleanupFormComplete(
  value: CleanupFormValue,
  existingSlots?: readonly EventSlotDTO[],
): boolean {
  return (
    value.title.trim().length > 0 &&
    value.coords !== null &&
    value.date !== null &&
    value.time !== null &&
    hasValidEventEnd(value) &&
    hasNamedSlot(value.slots) &&
    slotsValid(
      value.slots,
      existingSlots ? claimedBySlotId(existingSlots) : undefined,
      cleanupFormWindow(value),
    )
  )
}

const PREVIEW_ORGANIZER: PersonDTO = {
  id: "draft",
  name: "",
  handle: null,
  bio: null,
  avatar: null,
  avatarUrl: null,
  followers: 0,
  following: 0,
  isFollowing: false,
}

function KindSelector({
  value,
  onChange,
}: {
  value: EventKind
  onChange: (kind: EventKind) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-form")
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{t("field.eventType")}</Text>
      <View style={styles.segment} accessibilityRole="radiogroup">
        {EVENT_KIND_VALUES.map((kind) => {
          const active = value === kind
          return (
            <Pressable
              key={kind}
              onPress={() => onChange(kind)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(`enums:eventKind.${kind}`)}
              {...focusRingProps}
              style={(state) => [
                styles.segmentItem,
                webCursorPointer,
                webTransition,
                active ? styles.segmentItemActive : null,
                webHover(state) && !active ? styles.segmentItemHovered : null,
                state.pressed && !active ? styles.pressed : null,
              ]}
            >
              <Icon
                icon={kind === "cleanup" ? iconMap.Leaf : iconMap.Heart}
                size={15}
                color={active ? th.colors.neutral.card : th.colors.textMuted}
              />
              <Text
                style={[styles.segmentText, active ? styles.segmentTextActive : null]}
                numberOfLines={2}
              >
                {t(`enums:eventKind.${kind}`)}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function reportThumbUrl(report: ReportDTO): string | null {
  const photo = report.media.find((m) => m.kind === "image" && m.status === "ready")
  return photo ? (photo.thumbUrl ?? photo.url) : null
}

function reportToCardData(report: ReportDTO): LinkedReportCardData {
  return {
    id: report.id,
    category: report.category,
    type: report.type,
    title: report.title,
    description: report.description,
    status: report.status,
    thumbUrl: reportThumbUrl(report),
    addr: report.addr,
    referenceCode: report.referenceCode,
  }
}

function LinkedReportCardById({ id, onRemove }: { id: string; onRemove: () => void }) {
  const styles = useStyles()
  const query = useReport(id)

  if (query.isLoading) {
    return <View style={styles.seedSkeleton} />
  }
  if (query.isError || !query.data) {
    return null
  }
  return <LinkedReportCard report={reportToCardData(query.data)} layout="list" onRemove={onRemove} />
}

function MeetLocationCompact({
  value,
  onConfirmPoint,
  onClear,
  initialCenter,
}: {
  value: CleanupFormValue
  onConfirmPoint: (lat: number, lng: number) => void
  onClear: () => void
  initialCenter: LatLng | null
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t: tMap } = useT("map-ui")
  const [picking, setPicking] = useState(false)
  const label = useReverseLabel(value.coords)
  const display = value.coords ? reverseLabelText(label.data, value.coords) : null

  return (
    <View style={styles.compactLoc}>
      <Pressable
        onPress={() => setPicking(true)}
        accessibilityRole="button"
        accessibilityLabel={tMap("pickStep.openA11y")}
        {...focusRingProps}
        style={(state) => [
          styles.compactLocBtn,
          webCursorPointer,
          webTransition,
          webHover(state) ? styles.compactLocBtnHovered : null,
          state.pressed ? styles.pressed : null,
        ]}
      >
        <Icon icon={iconMap.MapPin} size={18} color={th.colors.brand.bloom} />
        <View style={styles.compactLocMeta}>
          {display ? (
            <Text style={styles.compactLocValue} numberOfLines={2}>
              {display}
            </Text>
          ) : (
            <Text style={styles.compactLocPlaceholder} numberOfLines={1}>
              {tMap("pickStep.open")}
            </Text>
          )}
        </View>
        <Icon
          icon={value.coords ? iconMap.ChevronRight : iconMap.Plus}
          size={16}
          color={th.colors.textMuted}
        />
      </Pressable>
      {value.coords ? (
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel={tMap("actions.reset")}
          hitSlop={6}
          {...focusRingProps}
          style={(state) => [
            styles.compactLocClear,
            webCursorPointer,
            webTransition,
            webHover(state) ? styles.compactLocClearHovered : null,
            state.pressed ? styles.pressed : null,
          ]}
        >
          <Icon icon={iconMap.Close} size={13} color={th.colors.textMuted} />
          <Text style={styles.compactLocClearText}>{tMap("actions.reset")}</Text>
        </Pressable>
      ) : null}

      <PortraitMapPickStep
        visible={picking}
        value={value.coords}
        initialCenter={initialCenter}
        onConfirm={(lat, lng) => {
          onConfirmPoint(lat, lng)
          setPicking(false)
        }}
        onCancel={() => setPicking(false)}
      />
    </View>
  )
}

export function CleanupForm({
  value,
  onChange,
  initialCenter,
  existingSlots,
  eventEndUnsaved = false,
  scheduleUnchanged = false,
  sections = ALL_CLEANUP_FORM_SECTIONS,
  showFeedShare = false,
  feedShareBusy = false,
  currentOrganization,
  onRequestFeedShareReveal,
}: {
  value: CleanupFormValue
  onChange: (next: CleanupFormValue) => void
  initialCenter?: LatLng | null
  existingSlots?: readonly EventSlotDTO[]
  eventEndUnsaved?: boolean
  scheduleUnchanged?: boolean
  currentOrganization?: OrganizationRefDTO | null
  sections?: readonly CleanupFormSection[]
  showFeedShare?: boolean
  feedShareBusy?: boolean
  onRequestFeedShareReveal?: (y: number) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-form")
  const { t: tCreate } = useT("event-create")
  const { locale } = useLocale()

  const layoutMode = useLayoutMode()
  const pickMode = layoutMode === "expanded" ? "main-map" : "standalone"
  const compact = layoutMode === "compact"

  const patch = useCallback(
    (partial: Partial<CleanupFormValue>) => onChange({ ...value, ...partial }),
    [onChange, value],
  )

  const onChangeDate = useCallback(
    (date: Date) => {
      const before =
        value.date && value.time ? formInstantMs(value.date, value.time, value.timezone) : null
      const time = value.time ? mergeDateTime(date, value.time) : value.time
      const endTime = value.endTime ? mergeDateTime(date, value.endTime) : value.endTime
      const after = time ? formInstantMs(date, time, value.timezone) : null
      patch({
        date,
        time,
        endTime,
        ...(before !== null && after !== null && before !== after
          ? { slots: shiftSlotDrafts(value.slots, after - before) }
          : {}),
      })
    },
    [patch, value.date, value.endTime, value.slots, value.time, value.timezone],
  )

  const onChangeStartTime = useCallback(
    (time: Date) => {
      const before =
        value.date && value.time ? formInstantMs(value.date, value.time, value.timezone) : null
      const after = value.date ? formInstantMs(value.date, time, value.timezone) : null
      const offset =
        value.time && value.endTime
          ? endOffsetMs(value.time, value.endTime)
          : DEFAULT_WIZARD_DURATION_MS
      const endTime = endTimeAfter(time, time, offset)
      patch({
        time,
        endTime,
        ...(before !== null && after !== null && before !== after
          ? { slots: shiftSlotDrafts(value.slots, after - before) }
          : {}),
      })
    },
    [patch, value.date, value.endTime, value.slots, value.time, value.timezone],
  )

  const onPickPlace = useCallback(
    (place: AddressPick) => {
      patch({
        coords: { lat: place.lat, lng: place.lng },
        spot: value.spot.trim().length > 0 ? value.spot : place.name,
      })
      if (pickMode === "main-map") useLocationPick.getState().setDraft(place.lat, place.lng)
    },
    [patch, value.spot, pickMode],
  )

  const onDropPin = useCallback(
    (lat: number, lng: number) => patch({ coords: { lat, lng } }),
    [patch],
  )

  const onChangeKind = useCallback(
    (eventKind: EventKind) => patch({ eventKind }),
    [patch],
  )

  const removeLink = useCallback(
    (id: string) => patch({ linkedReportIds: value.linkedReportIds.filter((x) => x !== id) }),
    [patch, value.linkedReportIds],
  )

  const isCleanup = value.eventKind === "cleanup"

  const myOrgs = useMyOrganizations()
  const hostOrganizations = useMemo<AuthorAsOption[]>(() => {
    const rows: AuthorAsOption[] = (actableOrganizations(myOrgs.data) ?? []).map((org) => ({
      id: org.id,
      name: org.name,
      logoUrl: org.logoUrl ?? null,
    }))
    if (currentOrganization && !rows.some((row) => row.id === currentOrganization.id)) {
      rows.unshift({
        id: currentOrganization.id,
        name: currentOrganization.name,
        logoUrl: currentOrganization.logoUrl ?? null,
      })
    }
    return rows
  }, [myOrgs.data, currentOrganization])
  const hostOrganizationId = authorAsSelection(
    value.organizationId,
    myOrgs.isSuccess ? hostOrganizations : undefined,
  )
  const latestForm = useRef(value)
  latestForm.current = value
  const commitForm = useRef(onChange)
  commitForm.current = onChange
  useEffect(() => {
    if (value.organizationId === null || hostOrganizationId !== null) return
    commitForm.current({ ...latestForm.current, organizationId: null })
  }, [value.organizationId, hostOrganizationId])

  const eventPreview = useMemo(() => {
    const ref = buildEventPreviewCard(value, PREVIEW_ORGANIZER)
    if (!ref) return null
    return {
      title: ref.title,
      whenLabel: new Date(ref.scheduledAt).toLocaleString(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    }
  }, [value, locale])

  const scheduleErrors = useMemo(() => {
    const found = scheduleFieldErrors(value, value.timezone)
    const stale = (key: string | undefined) =>
      key === undefined || (scheduleUnchanged && (key === "date_past" || key === "time_past"))
    const vars = { minutes: MIN_EVENT_DURATION_MINUTES }
    return {
      date: stale(found.date) ? null : t(`error.${found.date}`, vars),
      time: stale(found.time) ? null : t(`error.${found.time}`, vars),
      endTime: found.endTime ? t(`error.${found.endTime}`, vars) : null,
    }
  }, [scheduleUnchanged, t, value])

  const shows = (section: CleanupFormSection) => sections.includes(section)

  return (
    <>
      {shows("basics") ? (
        <>
          <AuthorAsChips
            organizations={hostOrganizations}
            value={hostOrganizationId}
            onChange={(organizationId) => patch({ organizationId })}
            label={tCreate("host_as.label")}
            personalLabel={tCreate("host_as.personal")}
            chipA11y={(name) => tCreate("host_as.a11y", { name })}
            groupA11y={tCreate("host_as.group_a11y")}
          />

          {isCleanup && value.linkedReportIds.length > 0 ? (
            <View style={styles.linkedCards}>
              {value.linkedReportIds.map((id) => (
                <LinkedReportCardById key={id} id={id} onRemove={() => removeLink(id)} />
              ))}
            </View>
          ) : null}

          <TextField
            label={t("field.title")}
            placeholder={t("field.titlePlaceholder")}
            value={value.title}
            onChangeText={(title) => patch({ title })}
            maxLength={120}
          />

          <TextField
            label={t("field.description")}
            placeholder={t("field.descriptionPlaceholder")}
            value={value.description}
            onChangeText={(description) => patch({ description })}
            multiline
            maxLength={2000}
          />

          <KindSelector value={value.eventKind} onChange={onChangeKind} />
        </>
      ) : null}

      {shows("where") ? (
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>{t("field.meetLocation")}</Text>
          {compact ? (
            <MeetLocationCompact
              value={value}
              onConfirmPoint={onDropPin}
              onClear={() => patch({ coords: null })}
              initialCenter={initialCenter ?? null}
            />
          ) : (
            <>
              <AddressSearch value={value.addrQuery} onChangeText={(addrQuery) => patch({ addrQuery })} onPick={onPickPlace} />
              <LocationPicker value={value.coords} onChange={onDropPin} onClear={() => patch({ coords: null })} initialCenter={initialCenter ?? undefined} mode={pickMode} />
            </>
          )}
          <TextField
            placeholder={t("field.spotPlaceholder")}
            value={value.spot}
            onChangeText={(spot) => patch({ spot })}
            maxLength={200}
          />
        </View>
      ) : null}

      {shows("when") ? (
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>{t("field.dateTime")}</Text>
          <InlineDateTimePicker
            date={value.date}
            time={value.time}
            endTime={value.endTime}
            timeZone={value.timezone}
            errors={scheduleErrors}
            onDateChange={onChangeDate}
            onTimeChange={onChangeStartTime}
            onEndTimeChange={(endTime) => patch({ endTime })}
          />
          <TimezoneField value={value.timezone} onChange={(timezone) => patch({ timezone })} />
        </View>
      ) : null}

      {shows("extras") ? (
        <>
          <View style={styles.fieldBlock}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>{t("field.slots")}</Text>
            </View>
            <Text style={styles.fieldHelp}>{t("field.slotsHelp")}</Text>
            <SlotEditor
              value={value.slots}
              onChange={(slots) => patch({ slots })}
              window={cleanupFormWindow(value)}
              timeZone={value.timezone}
              eventEndUnsaved={eventEndUnsaved}
              {...(existingSlots ? { existing: existingSlots } : {})}
            />
          </View>

          <View style={styles.fieldBlock}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>{t("field.whatToBring")}</Text>
              <MetaDot color={th.colors.textSubtle} style={styles.labelDot} />
              <Text style={styles.optional}>{t("field.optional")}</Text>
            </View>
            <BringInput value={value.bring} onChange={(bring) => patch({ bring })} />
          </View>
        </>
      ) : null}

      {shows("share") && showFeedShare ? (
        <FeedShareBlock
          enabled={value.shareToFeed}
          onToggle={(shareToFeed) => patch({ shareToFeed })}
          caption={value.feedCaption}
          onChangeCaption={(feedCaption) => patch({ feedCaption })}
          label={t("share.label")}
          helper={t("share.helper")}
          captionPlaceholder={t("share.caption_placeholder")}
          captionA11yLabel={t("share.caption_a11y")}
          nowLabel={t("share.now")}
          attachmentPlaceholder={t("share.card_placeholder")}
          busy={feedShareBusy}
          onRequestReveal={onRequestFeedShareReveal}
          attachment={
            eventPreview ? (
              <FeedShareEventCard title={eventPreview.title} whenLabel={eventPreview.whenLabel} />
            ) : null
          }
        />
      ) : null}
    </>
  )
}

const useStyles = makeThemedStyles((t) => ({
  fieldBlock: {
    gap: t.space["2"],
  },
  fieldLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  labelDot: {
    marginHorizontal: 6,
  },
  optional: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  fieldHelp: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    lineHeight: 16,
    color: t.colors.textSubtle,
    marginTop: -t.space["1"],
  },

  linkedCards: {
    gap: t.space["2"],
  },

  segment: {
    flexDirection: "row",
    gap: t.space["1"],
    padding: 4,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
  },
  segmentItem: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    paddingVertical: t.space["1"],
    paddingHorizontal: t.space["2"],
    borderRadius: t.radius.pill,
  },
  segmentItemActive: {
    backgroundColor: t.colors.text,
  },
  segmentItemHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  segmentText: {
    flexShrink: 1,
    textAlign: "center",
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
    color: t.colors.textMuted,
  },
  segmentTextActive: {
    color: t.colors.neutral.card,
  },

  seedSkeleton: {
    height: 64,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },

  compactLoc: {
    gap: t.space["2"],
  },
  compactLocBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    minHeight: 52,
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["3"],
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  compactLocBtnHovered: {
    backgroundColor: t.colors.surfaceTint,
    borderColor: t.colors.borderStrong,
  },
  compactLocMeta: {
    flex: 1,
    minWidth: 0,
  },
  compactLocValue: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 14,
    color: t.colors.text,
  },
  compactLocPlaceholder: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 15,
    color: t.colors.textSubtle,
  },
  compactLocClear: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: t.radius.pill,
  },
  compactLocClearHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  compactLocClearText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12,
    color: t.colors.textMuted,
  },

  pressed: {
    opacity: 0.85,
  },
}))

