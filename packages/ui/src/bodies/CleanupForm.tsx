import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, View, Image, Pressable, StyleSheet } from "react-native"
import {
  EVENT_KIND_VALUES,
  MAX_EVENT_ADDRESS_LENGTH,
  MIN_EVENT_DURATION_MINUTES,
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
import { useLocale, useT } from "../i18n"
import { AddressSearch, type AddressPick } from "./AddressSearch"
import { AuthorAsChips, authorAsSelection, type AuthorAsOption } from "./AuthorAsChips"
import { buildEventPreviewCard } from "./feedShare"
import { FeedShareBlock, FeedShareEventCard } from "./FeedShareBlock"
import { draftWhenLabel, scheduleFieldErrors } from "./calendarModel"
import { InlineDateTimePicker } from "./InlineDateTimePicker"
import { ReportLinkPicker } from "./ReportLinkPicker"
import { linkBlockState } from "./linkReportsModel"
import { TimezoneField } from "./TimezoneField"
import { SlotEditor } from "./SlotEditor"
import {
  cleanupFormWindow,
  dateChangePatch,
  startTimeChangePatch,
  timezoneChangePatch,
  type CleanupFormValue,
} from "./cleanupFormModel"

const COVER_RATIO = 16 / 9

/** The create and update schemas' caps (`CreateCleanupRequest`), which export no named constant. */
const EVENT_TITLE_MAX_LENGTH = 120
const EVENT_DESCRIPTION_MAX_LENGTH = 2000

export type CleanupFormSection = "basics" | "when" | "where" | "extras" | "share"

const ALL_CLEANUP_FORM_SECTIONS: readonly CleanupFormSection[] = [
  "basics",
  "when",
  "where",
  "extras",
  "share",
]

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

type FormPatch = (partial: Partial<CleanupFormValue>) => void

/**
 * The cover picker's upload. It writes through `mergeIntoCurrent` (a merge into the host's CURRENT value),
 * never `patchRendered`: the upload lands after an await, and a spread of the value captured before it
 * would drop everything typed meanwhile.
 */
function useCoverUpload({
  mergeIntoCurrent,
  patchRendered,
}: {
  mergeIntoCurrent: FormPatch
  patchRendered: FormPatch
}) {
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
        mergeIntoCurrent({ coverMediaId: uploaded.mediaId, coverPreviewUrl: picked.uri })
      } catch (err) {
        setCoverErrorKey(eventCoverErrorKey(appErrorCode(err)))
      } finally {
        setCoverUploading(false)
      }
    })()
  }, [api, camera, coverUploading, mergeIntoCurrent])

  const onRemoveCover = useCallback(() => {
    setCoverErrorKey(null)
    patchRendered({ coverMediaId: null, coverPreviewUrl: null })
  }, [patchRendered])

  return { coverUploading, coverErrorKey, onPickCover, onRemoveCover }
}

type CoverUpload = ReturnType<typeof useCoverUpload>

/**
 * The organizations the viewer can host as, plus the event's current one when editing. Runs on every step,
 * not only where the chips render, so a selection the viewer lost is cleared from the draft they submit.
 */
function useHostOrganizations(
  value: CleanupFormValue,
  onChange: (next: CleanupFormValue) => void,
  currentOrganization: OrganizationRefDTO | null | undefined,
) {
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

  return { hostOrganizations, hostOrganizationId }
}

function CoverField({ value, cover }: { value: CleanupFormValue; cover: CoverUpload }) {
  const styles = useStyles()
  const { t } = useT("event-form")
  const { coverUploading, coverErrorKey, onPickCover, onRemoveCover } = cover
  return (
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
  )
}

function BasicsSection({
  value,
  patch,
  hostOrganizations,
  hostOrganizationId,
  cover,
}: {
  value: CleanupFormValue
  patch: FormPatch
  hostOrganizations: AuthorAsOption[]
  hostOrganizationId: string | null
  cover: CoverUpload
}) {
  const { t } = useT("event-form")
  const { t: tCreate } = useT("event-create")
  const onChangeKind = useCallback((eventKind: EventKind) => patch({ eventKind }), [patch])

  return (
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
        maxLength={EVENT_TITLE_MAX_LENGTH}
      />

      <TextField
        label={t("field.description")}
        placeholder={t("field.descriptionPlaceholder")}
        value={value.description}
        onChangeText={(description) => patch({ description })}
        multiline
        maxLength={EVENT_DESCRIPTION_MAX_LENGTH}
      />

      <KindSelector value={value.eventKind} onChange={onChangeKind} />

      <CoverField value={value} cover={cover} />
    </>
  )
}

function MeetLocationField({
  value,
  patch,
  initialCenter,
  centerSettled,
}: {
  value: CleanupFormValue
  patch: FormPatch
  initialCenter: LatLng | null | undefined
  centerSettled: boolean | undefined
}) {
  const styles = useStyles()
  const { t } = useT("event-form")
  const layoutMode = useLayoutMode()
  const pickMode = layoutMode === "expanded" ? "main-map" : "standalone"
  const compact = layoutMode === "compact"
  const pin = useMemo(() => eventPinTarget(value.eventKind), [value.eventKind])

  const onPickPlace = useCallback(
    (place: AddressPick) => patch({ coords: { lat: place.lat, lng: place.lng } }),
    [patch],
  )

  const onDropPin = useCallback(
    (lat: number, lng: number) => patch({ coords: { lat, lng } }),
    [patch],
  )

  return (
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
  )
}

function WhenSection({
  value,
  patch,
  scheduleUnchanged,
}: {
  value: CleanupFormValue
  patch: FormPatch
  scheduleUnchanged: boolean
}) {
  const styles = useStyles()
  const { t } = useT("event-form")

  const onChangeDate = useCallback((date: Date) => patch(dateChangePatch(value, date)), [patch, value])

  const onChangeStartTime = useCallback(
    (time: Date) => patch(startTimeChangePatch(value, time)),
    [patch, value],
  )

  const onChangeTimezone = useCallback(
    (timezone: string) => patch(timezoneChangePatch(value, timezone)),
    [patch, value],
  )

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

  return (
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
  )
}

function ExtrasSection({
  value,
  patch,
  existingSlots,
  eventEndUnsaved,
}: {
  value: CleanupFormValue
  patch: FormPatch
  existingSlots: readonly EventSlotDTO[] | undefined
  eventEndUnsaved: boolean
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-form")
  return (
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
  )
}

function ShareSection({
  value,
  patch,
  busy,
  onRequestReveal,
}: {
  value: CleanupFormValue
  patch: FormPatch
  busy: boolean
  onRequestReveal: ((y: number) => void) | undefined
}) {
  const { t } = useT("event-form")
  const { locale } = useLocale()

  const eventPreview = useMemo(() => {
    const ref = buildEventPreviewCard(value, PREVIEW_ORGANIZER)
    if (!ref) return null
    return {
      title: ref.title,
      whenLabel: draftWhenLabel(new Date(ref.scheduledAt), locale),
    }
  }, [value, locale])

  return (
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
      busy={busy}
      onRequestReveal={onRequestReveal}
      attachment={
        eventPreview ? (
          <FeedShareEventCard title={eventPreview.title} whenLabel={eventPreview.whenLabel} />
        ) : null
      }
    />
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
  const patch = useCallback(
    (partial: Partial<CleanupFormValue>) => onChange({ ...value, ...partial }),
    [onChange, value],
  )
  const cover = useCoverUpload({ mergeIntoCurrent: onPatch, patchRendered: patch })
  const { hostOrganizations, hostOrganizationId } = useHostOrganizations(
    value,
    onChange,
    currentOrganization,
  )

  const shows = (section: CleanupFormSection) => sections.includes(section)

  return (
    <>
      {shows("basics") ? (
        <BasicsSection
          value={value}
          patch={patch}
          hostOrganizations={hostOrganizations}
          hostOrganizationId={hostOrganizationId}
          cover={cover}
        />
      ) : null}

      {shows("where") ? (
        <>
          <MeetLocationField
            value={value}
            patch={patch}
            initialCenter={initialCenter}
            centerSettled={centerSettled}
          />

          <ReportLinkPicker
            value={value.linkedReportIds}
            onChange={(linkedReportIds) => patch({ linkedReportIds })}
            center={value.coords}
            state={linkBlockState({
              isCleanup: value.eventKind === "cleanup",
              hasCoords: value.coords !== null,
              linkedCount: value.linkedReportIds.length,
            })}
          />
        </>
      ) : null}

      {shows("when") ? (
        <WhenSection value={value} patch={patch} scheduleUnchanged={scheduleUnchanged} />
      ) : null}

      {shows("extras") ? (
        <ExtrasSection
          value={value}
          patch={patch}
          existingSlots={existingSlots}
          eventEndUnsaved={eventEndUnsaved}
        />
      ) : null}

      {shows("share") && showFeedShare ? (
        <ShareSection
          value={value}
          patch={patch}
          busy={feedShareBusy}
          onRequestReveal={onRequestFeedShareReveal}
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
    padding: t.space["1"],
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
    minHeight: t.space["10"],
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
    fontSize: t.fontSize["13"],
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
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  compactLocPlaceholder: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["15"],
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
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
  },

  pressed: {
    opacity: 0.85,
  },
}))

