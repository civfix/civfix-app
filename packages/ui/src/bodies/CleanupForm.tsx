import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, View, Image, Pressable, StyleSheet } from "react-native"
import {
  EVENT_KIND_VALUES,
  MAX_EVENT_ADDRESS_LENGTH,
  MIN_EVENT_DURATION_MINUTES,
  type EventAddressSource,
  type EventKind,
  type EventSlotDTO,
  type OrganizationRefDTO,
  type PersonDTO,
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
import { MIN_TOUCH_TARGET } from "../theme/touchTarget"
import { TextField, BringInput, MetaDot, SecondaryButton } from "../primitives"
import {
  actableOrganizations,
  useMyOrganizations,
  useResolveAddress,
  useReverseLabel,
  resolvedAddressValue,
  reverseLabelText,
} from "../data"
import {
  eventAddressEdit,
  eventAddressPinMoved,
  eventAddressPrefill,
  eventAddressStatus,
  isEventAddressComplete,
  type EventAddressValue,
} from "./eventAddressField"
import { useApi } from "../data/context"
import { uploadMedia } from "../data/uploadMedia"
import { useCamera } from "../capabilities"
import { appErrorCode } from "../data/errorCode"
import { eventCoverErrorKey } from "./eventCoverModel"
import { LocationPicker, PortraitMapPickStep, eventPinTarget } from "../map"
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
import { ReportLinkPicker } from "./ReportLinkPicker"
import { linkBlockState } from "./linkReportsModel"
import { TimezoneField } from "./TimezoneField"
import { DEFAULT_WIZARD_DURATION_MS, eventDraftWindow, slotsAfterZoneChange } from "./eventWizard"
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

const COVER_RATIO = 16 / 9

export interface CleanupFormValue {
  organizationId: string | null
  title: string
  description: string
  eventKind: EventKind
  addrQuery: string
  spot: string
  address: string
  addressSource: EventAddressSource | null
  addressPointKey: string | null
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
  coverMediaId: string | null
  coverPreviewUrl: string | null
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
    address: "",
    addressSource: null,
    addressPointKey: null,
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
    coverMediaId: null,
    coverPreviewUrl: null,
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
    isEventAddressComplete(value.address) &&
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
              accessibilityState={{ checked: active }}
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

function MeetLocationCompact({
  value,
  onConfirmPoint,
  onClear,
  initialCenter,
  centerSettled,
}: {
  value: CleanupFormValue
  onConfirmPoint: (lat: number, lng: number) => void
  onClear: () => void
  initialCenter: LatLng | null
  centerSettled: boolean | undefined
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t: tMap } = useT("map-ui")
  const [picking, setPicking] = useState(false)
  const pin = useMemo(() => eventPinTarget(value.eventKind), [value.eventKind])
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
        centerSettled={centerSettled}
        onConfirm={(lat, lng) => {
          onConfirmPoint(lat, lng)
          setPicking(false)
        }}
        onCancel={() => setPicking(false)}
        pin={pin}
      />
    </View>
  )
}

function MeetAddressField({
  value,
  onPatch,
}: {
  value: CleanupFormValue
  onPatch: (next: EventAddressValue) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-form")
  const resolution = useResolveAddress(value.coords)
  const near = useCallback((line: string) => t("address.near", { address: line }), [t])

  const current = useMemo<EventAddressValue>(
    () => ({
      address: value.address,
      addressSource: value.addressSource,
      addressPointKey: value.addressPointKey,
    }),
    [value.address, value.addressSource, value.addressPointKey],
  )

  const commit = useRef(onPatch)
  commit.current = onPatch
  const settled = resolvedAddressValue(resolution)
  useEffect(() => {
    const next = eventAddressPrefill({
      coords: value.coords,
      resolution: settled,
      current,
      near,
    })
    if (next) commit.current(next)
  }, [value.coords, settled, current, near])

  const status = eventAddressStatus({
    hasCoords: value.coords !== null,
    isResolving: resolution.isPending,
    resolveFailed: resolution.isError,
    addressSource: value.addressSource,
  })
  const pinMoved = eventAddressPinMoved({ coords: value.coords, current })
  const missing = value.coords !== null && status !== "resolving" && !isEventAddressComplete(value.address)
  const cityHint = resolution.data?.cityStateLabel?.trim() ?? ""

  return (
    <View style={styles.addressBlock}>
      <TextField
        label={t("address.label")}
        placeholder={status === "manual" ? t("address.placeholderManual") : t("address.placeholder")}
        value={value.address}
        onChangeText={(text) =>
          commit.current(eventAddressEdit({ text, coords: value.coords, current }))
        }
        maxLength={MAX_EVENT_ADDRESS_LENGTH}
        editable={value.coords !== null}
      />
      {value.coords === null ? (
        <Text style={styles.addressHint}>{t("address.pinFirst")}</Text>
      ) : status === "resolving" ? (
        <View style={styles.addressNote}>
          <ActivityIndicator size="small" color={th.colors.textSubtle} />
          <Text style={styles.addressHint}>{t("address.resolving")}</Text>
        </View>
      ) : status === "manual" && value.address.trim().length === 0 ? (
        <View style={styles.addressNote}>
          <Icon icon={iconMap.AlertCircle} size={13} color={th.colors.brand.bloom} />
          <Text style={styles.addressError}>
            {cityHint.length > 0
              ? t("address.manualRequiredNear", { cityState: cityHint })
              : t("address.manualRequired")}
          </Text>
        </View>
      ) : missing ? (
        <View style={styles.addressNote}>
          <Icon icon={iconMap.AlertCircle} size={13} color={th.colors.brand.bloom} />
          <Text style={styles.addressError}>{t("address.tooShort")}</Text>
        </View>
      ) : pinMoved ? (
        <View style={styles.addressNote}>
          <Icon icon={iconMap.Info} size={13} color={th.colors.textSubtle} />
          <Text style={styles.addressHint}>{t("address.pinMoved")}</Text>
        </View>
      ) : (
        <Text style={styles.addressHint}>{t("address.confirmHint")}</Text>
      )}
    </View>
  )
}

export function CleanupForm({
  value,
  onChange,
  onPatch,
  initialCenter,
  centerSettled,
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
  /** Merges into the host's CURRENT value; for writes that land after an await. */
  onPatch: (partial: Partial<CleanupFormValue>) => void
  initialCenter?: LatLng | null
  /** The host's centre resolution finished with no point, so the pickers offer address search instead of waiting. */
  centerSettled?: boolean
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

  const api = useApi()
  const camera = useCamera()
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverErrorKey, setCoverErrorKey] = useState<string | null>(null)

  const onPickCover = useCallback(() => {
    if (coverUploading) return
    void (async () => {
      setCoverUploading(true)
      setCoverErrorKey(null)
      try {
        const picked = await camera.pickFromLibrary()
        if (!picked) return
        if (picked.kind !== "image") {
          setCoverErrorKey("cover.error_not_image")
          return
        }
        const uploaded = await uploadMedia({ api, camera, media: picked })
        onPatch({ coverMediaId: uploaded.mediaId, coverPreviewUrl: picked.uri })
      } catch (err) {
        setCoverErrorKey(eventCoverErrorKey(appErrorCode(err)))
      } finally {
        setCoverUploading(false)
      }
    })()
  }, [api, camera, coverUploading, onPatch])

  const onRemoveCover = useCallback(() => {
    setCoverErrorKey(null)
    patch({ coverMediaId: null, coverPreviewUrl: null })
  }, [patch])

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

  const onChangeTimezone = useCallback(
    (timezone: string) => {
      patch({
        timezone,
        slots: slotsAfterZoneChange(value.slots, value.date, value.time, value.timezone, timezone),
      })
    },
    [patch, value.date, value.slots, value.time, value.timezone],
  )

  const onPickPlace = useCallback(
    (place: AddressPick) => patch({ coords: { lat: place.lat, lng: place.lng } }),
    [patch],
  )

  const onDropPin = useCallback(
    (lat: number, lng: number) => patch({ coords: { lat, lng } }),
    [patch],
  )

  const onChangeKind = useCallback(
    (eventKind: EventKind) => patch({ eventKind }),
    [patch],
  )

  const isCleanup = value.eventKind === "cleanup"
  const pin = useMemo(() => eventPinTarget(value.eventKind), [value.eventKind])

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

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>{t("cover.label")}</Text>
            <Text style={styles.coverHint}>{t("cover.hint")}</Text>
            {value.coverPreviewUrl ? (
              <View style={styles.coverFrame}>
                <Image
                  source={{ uri: value.coverPreviewUrl }}
                  style={styles.coverImage}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              </View>
            ) : null}
            <View style={styles.coverActions}>
              <SecondaryButton
                size="sm"
                label={
                  coverUploading
                    ? t("cover.uploading")
                    : value.coverPreviewUrl
                      ? t("cover.replace")
                      : t("cover.add")
                }
                onPress={onPickCover}
                disabled={coverUploading}
              />
              {value.coverPreviewUrl ? (
                <Pressable
                  onPress={onRemoveCover}
                  disabled={coverUploading}
                  accessibilityRole="button"
                  accessibilityLabel={t("cover.remove")}
                  {...focusRingProps}
                  style={(state) => [
                    styles.coverGhost,
                    webCursorPointer,
                    state.pressed ? styles.coverGhostPressed : null,
                  ]}
                >
                  <Text style={styles.coverGhostText}>{t("cover.remove")}</Text>
                </Pressable>
              ) : null}
            </View>
            {coverErrorKey ? <Text style={styles.coverError}>{t(coverErrorKey)}</Text> : null}
          </View>
        </>
      ) : null}

      {shows("where") ? (
        <>
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>{t("field.meetLocation")}</Text>
            {compact ? (
              <MeetLocationCompact
                value={value}
                onConfirmPoint={onDropPin}
                onClear={() => patch({ coords: null })}
                initialCenter={initialCenter ?? null}
                centerSettled={centerSettled}
              />
            ) : (
              <>
                <AddressSearch value={value.addrQuery} onChangeText={(addrQuery) => patch({ addrQuery })} onPick={onPickPlace} />
                <LocationPicker value={value.coords} onChange={onDropPin} onClear={() => patch({ coords: null })} initialCenter={initialCenter ?? undefined} centerSettled={centerSettled} mode={pickMode} pin={pin} />
              </>
            )}
            <TextField
              placeholder={t("field.spotPlaceholder")}
              value={value.spot}
              onChangeText={(spot) => patch({ spot })}
              maxLength={MAX_EVENT_ADDRESS_LENGTH}
            />
            <MeetAddressField value={value} onPatch={patch} />
          </View>

          <ReportLinkPicker
            value={value.linkedReportIds}
            onChange={(linkedReportIds) => patch({ linkedReportIds })}
            center={value.coords}
            state={linkBlockState({
              isCleanup,
              hasCoords: value.coords !== null,
              linkedCount: value.linkedReportIds.length,
            })}
          />
        </>
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
          <TimezoneField value={value.timezone} onChange={onChangeTimezone} />
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
  coverHint: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  coverFrame: {
    aspectRatio: COVER_RATIO,
    borderRadius: t.radius.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.bgAlt,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  coverGhost: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    paddingHorizontal: t.space["2"],
  },
  coverGhostPressed: {
    opacity: 0.7,
  },
  coverGhostText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
  },
  coverError: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.brand.bloom,
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

  addressBlock: {
    gap: t.space["1"],
  },
  addressNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addressHint: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    lineHeight: 16,
    color: t.colors.textSubtle,
  },
  addressError: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    lineHeight: 16,
    color: t.colors.brand.bloom,
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
    minHeight: MIN_TOUCH_TARGET,
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

