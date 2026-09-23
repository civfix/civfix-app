import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View, Platform, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import type { ReportCategory, ReportType as SharedReportType } from "@civfix/shared"
import { MAX_REPORT_ADDR_LENGTH } from "@civfix/shared"
import type { ApiClient } from "@civfix/shared/client"
import { type LatLng } from "@civfix/shared/geocode"
import { makeThemedStyles, motion, useTheme, categoryColor, wash, useLayoutMode, focusRingProps, type LayoutMode } from "../theme"
import { alpha } from "../theme/alpha"
import { Text, Icon, iconMap } from "../typography"
import { TextField, Toggle, KeyboardPinnedFooter, KeyboardPinnedSurface, PrimaryButton, CategoryChip, MediaPreview, SuccessCheck } from "../primitives"
import { LocationPicker, PortraitMapPickStep, useLocationPick, reportPinTarget } from "../map"
import { PinSvg, glyphForCategory } from "../map"
import {
  useApi,
  useAuthState,
  useResolveAddress,
  resolvedAddressValue,
  useResolveJurisdiction,
  useReverseLabel,
  reverseLabelText,
  useMyProfile,
  fetchApproximateLocation,
  queryKeys,
} from "../data"
import { useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import {
  DETAIL_BACK_SIZE,
  DETAIL_BACK_RADIUS,
  DETAIL_BACK_ICON_SIZE,
  detailTitleStyle,
} from "../shell/detailHeader"
import { showBackAffordance } from "../shell/backAffordance"
import { StepTransition } from "../shell/StepTransition"
import { WizardStepHeader } from "../shell/WizardStepHeader"
import { useStackDirection } from "../shell/useStackDirection"
import { AddressSearch, type AddressPick } from "./AddressSearch"
import { reportAddressPrefill } from "./reportAddressField"
import { announce } from "../announce"
import { appErrorCode } from "./errorCode"
import { HEADER_CONTROL_SIZE } from "./headerControls"
import { HeaderProfileButton } from "./HeaderProfileButton"
import { FeedShareBlock, FeedSharePreview } from "./FeedShareBlock"
import { LinkedReportCard } from "./LinkedReportCard"
import { buildReportPreviewCard, type FeedShareOutcome } from "./feedShare"
import { useCamera, useGeolocation, useHaptics } from "../capabilities"
import type { CapturedMedia } from "../capabilities"
import { REPORT_TYPES, type ReportType } from "../report/reportTypes"
import { useDraftReportStore, MAX_DRAFT_MEDIA } from "../report/draftStore"
import { usePostComposerStore } from "./postComposerStore"
import {
  deferReportRunRelease,
  reportRunSurvivesView,
  type ReportRunExitHost,
} from "./postComposerExit"
import {
  type Step,
  stepOrderFor,
  resumeStep,
  stepAfterCapture,
  showsWizardFooter,
  wizardHeaderMode,
  rendersEmbeddedViewfinder,
  viewfinderResumeGraceEligible,
  viewfinderSessionActive,
  pickLayerVisible,
} from "../report/wizardSteps"
import {
  useCaptureDropTarget,
  captureDropTargetStyle,
  captureDropActiveStyleFor,
  type DroppedItem,
} from "../report/captureDropTarget"
import { useReportSubmit, useFeedShareRetry, type ReportSubmitOutcome } from "../report/submit"
import { useT } from "../i18n"
import type { TFunction } from "i18next"

const REPORT_RUN_EXIT_HOST: ReportRunExitHost = {
  readView: () => useNavStore.getState().view,
  release: () => usePostComposerStore.getState().releaseClaimedCreate("report"),
  watchView: (onNavChange) => useNavStore.subscribe(onNavChange),
}

function submitErrorMessage(err: unknown, t: TFunction): string {
  const code = appErrorCode(err)
  switch (code) {
    case "VALIDATION":
    case "GPS_IMPLAUSIBLE":
      return t("errors.validation")
    case "RATE_LIMITED":
      return t("errors.rate_limited")
    case "TURNSTILE_FAILED":
      return t("errors.turnstile_failed")
    case "MEDIA_REJECTED":
      return t("errors.media_rejected")
    case "UNAUTHORIZED":
    case "FORBIDDEN":
      return t("errors.unauthorized")
    default:
      return t("errors.generic")
  }
}

function ReportTypeRow({ type, selected, onPress }: { type: ReportType; selected: boolean; onPress: () => void }) {
  const styles = useStyles()
  const th = useTheme()
  const color = categoryColor(type.category, th.scheme)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={type.label}
      {...focusRingProps}
      style={({ pressed }) => [
        styles.typeRow,
        selected ? { borderColor: color, backgroundColor: wash(color, 0.92, th) } : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {type.glyph ? (
        <View style={styles.glyphCircle}>
          <Icon icon={iconMap.Plus} size={18} color={th.colors.textMuted} />
        </View>
      ) : (
        <PinSvg fill={color} glyph={glyphForCategory(type.category)} size={30} />
      )}
      <View style={styles.typeMeta}>
        <Text style={styles.typeTitle}>{type.label}</Text>
        <Text style={styles.typeSub}>{type.sub}</Text>
      </View>
      <View style={[styles.check, selected ? { backgroundColor: color, borderColor: color } : null]}>
        {selected ? <Icon icon={iconMap.Check} size={15} color={th.colors.onAccent} /> : null}
      </View>
    </Pressable>
  )
}


function CaptureStep({ mode }: { mode: LayoutMode }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-wizard")
  const camera = useCamera()
  const media = useDraftReportStore((s) => s.draft.media)
  const startFromCapture = useDraftReportStore((s) => s.startFromCapture)
  const addCapture = useDraftReportStore((s) => s.addCapture)
  const removeMedia = useDraftReportStore((s) => s.removeMedia)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  const land = useCallback(
    async (produce: () => Promise<CapturedMedia | null>) => {
      if (busy) return
      setBusy(true)
      setHint(null)
      try {
        const captured = await produce()
        if (captured) {
          if (useDraftReportStore.getState().draft.media.length === 0) startFromCapture(captured)
          else addCapture(captured)
        }
      } catch {
        setHint(t("capture.camera_error"))
      } finally {
        setBusy(false)
      }
    },
    [busy, startFromCapture, addCapture, t],
  )

  const run = useCallback(
    (kind: "capture" | "library") =>
      land(
        kind === "capture"
          ?
            () => camera.capture({ orientation: "portrait" })
          : () => camera.pickFromLibrary(),
      ),
    [camera, land],
  )

  const acceptFile = camera.acceptFile
  const onDropFiles = useCallback(
    (items: readonly DroppedItem[]) => {
      const first = items[0]
      if (first === undefined || !acceptFile) return
      void land(() => acceptFile(first))
    },
    [acceptFile, land],
  )
  const drop = useCaptureDropTarget(mode === "expanded" && acceptFile != null, onDropFiles)

  if (media.length > 0) {
    const atCap = media.length >= MAX_DRAFT_MEDIA
    return (
      <View style={styles.stepBlock}>
        <Text style={styles.fieldLabel}>{t("capture.label_filled")}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.captureStrip}
        >
          {media.map((m) => (
            <View key={m.id} style={styles.captureThumbWrap}>
              <MediaPreview uri={m.uri} kind={m.kind} aspectRatio={1} style={styles.captureThumb} />
              <Pressable
                onPress={() => removeMedia(m.id)}
                accessibilityRole="button"
                accessibilityLabel={t("capture.remove_item_a11y")}
                hitSlop={6}
                {...focusRingProps}
                style={({ pressed }) => [styles.captureRemove, pressed ? styles.pressed : null]}
              >
                <Icon icon={iconMap.Close} size={13} color={th.colors.onScrim} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
        <View style={styles.captureActions}>
          <Pressable
            onPress={() => run("capture")}
            disabled={busy || atCap}
            accessibilityRole="button"
            accessibilityLabel={t("capture.add_camera_a11y")}
            {...focusRingProps}
            style={({ pressed }) => [
              styles.retakeBtn,
              pressed ? styles.pressed : null,
              atCap ? styles.retakeDisabled : null,
            ]}
          >
            <Icon icon={iconMap.Camera} size={16} color={th.colors.textMuted} />
            <Text style={styles.retakeText}>{t("capture.camera")}</Text>
          </Pressable>
          <Pressable
            onPress={() => run("library")}
            disabled={busy || atCap}
            accessibilityRole="button"
            accessibilityLabel={t("capture.add_library_a11y")}
            {...focusRingProps}
            style={({ pressed }) => [
              styles.retakeBtn,
              pressed ? styles.pressed : null,
              atCap ? styles.retakeDisabled : null,
            ]}
          >
            <Icon icon={iconMap.Plus} size={16} color={th.colors.textMuted} />
            <Text style={styles.retakeText}>{t("capture.library")}</Text>
          </Pressable>
        </View>
        <Text style={styles.captureHint}>
          {atCap
            ? t("capture.hint_at_cap", { max: MAX_DRAFT_MEDIA })
            : t("capture.hint_add_more", { count: MAX_DRAFT_MEDIA })}
        </Text>
        {hint ? <Text style={styles.hintText}>{hint}</Text> : null}
      </View>
    )
  }

  const fill = mode === "expanded"
  return (
    <View style={[styles.stepBlock, fill ? styles.stepBlockFill : null]}>
      <Pressable
        ref={drop.ref}
        onPress={() => run("capture")}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t("capture.capture_a11y")}
        {...focusRingProps}
        style={({ pressed }) => [
          styles.photoDrop,
          fill ? styles.photoDropFill : null,
          th.shadows.pin,
          drop.active ? captureDropTargetStyle : null,
          drop.dragging ? captureDropActiveStyleFor(th) : null,
          pressed ? styles.pressed : null,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={th.colors.neutral.card} />
        ) : (
          <Icon icon={iconMap.Camera} size={30} color={th.colors.neutral.card} />
        )}
        <Text style={styles.photoDropTitle}>{t("capture.drop_title")}</Text>
        <Text style={styles.photoDropSub}>{t("capture.drop_sub")}</Text>
      </Pressable>
      <Pressable
        onPress={() => run("library")}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t("capture.choose_library_a11y")}
        {...focusRingProps}
        style={({ pressed }) => [styles.libraryLink, pressed ? styles.pressed : null]}
      >
        <Icon icon={iconMap.Plus} size={15} color={th.colors.textMuted} />
        <Text style={styles.libraryLinkText}>{t("capture.choose_library")}</Text>
      </Pressable>
      {drop.active ? (
        <Text variant="caption" color={th.colors.textSubtle} style={styles.dragHint}>
          {t("capture.drag_hint")}
        </Text>
      ) : null}
      {hint ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  )
}

function CategoryStep() {
  const styles = useStyles()
  const reportTypeId = useDraftReportStore((s) => s.draft.reportTypeId)
  const setCategory = useDraftReportStore((s) => s.setCategory)
  return (
    <View style={styles.stepBlock}>
      <View style={styles.typeList}>
        {REPORT_TYPES.map((type) => (
          <ReportTypeRow
            key={type.id}
            type={type}
            selected={reportTypeId === type.id}
            onPress={() => setCategory(type.category, type.glyph ? "" : type.label, type.id)}
          />
        ))}
      </View>
    </View>
  )
}

function DetailsStep() {
  const styles = useStyles()
  const { t } = useT("report-wizard")
  const draft = useDraftReportStore((s) => s.draft)
  const setTitle = useDraftReportStore((s) => s.setTitle)
  const setDescription = useDraftReportStore((s) => s.setDescription)
  const setFlag = useDraftReportStore((s) => s.setFlag)
  return (
    <View style={styles.stepBlock}>
      <TextField
        label={t("details.title_label")}
        placeholder={t("details.title_placeholder")}
        value={draft.title}
        onChangeText={setTitle}
        maxLength={120}
      />
      <TextField
        label={t("details.description_label")}
        placeholder={t("details.description_placeholder")}
        value={draft.description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
      />
      <View style={styles.toggles}>
        <Toggle
          label={t("details.flag_blocking")}
          value={draft.flags.blockingSidewalk}
          onValueChange={(v) => setFlag("blockingSidewalk", v)}
        />
        <Toggle
          label={t("details.flag_safety")}
          value={draft.flags.safetyHazard}
          onValueChange={(v) => setFlag("safetyHazard", v)}
        />
      </View>
    </View>
  )
}

const DEVICE_FIX_TIMEOUT_MS = 4000

const VIEWFINDER_MOUNT_DELAY_MS = motion.pagePush.duration

const PICK_LAYER_LINGER_MS = 400

const PICK_LAYER_LINGERS = Platform.OS !== "web"

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((settle) => {
    const timer = setTimeout(() => settle(null), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        settle(value)
      },
      () => {
        clearTimeout(timer)
        settle(null)
      },
    )
  })
}

async function resolveApproxCenter(
  geo: ReturnType<typeof useGeolocation>,
  api: ApiClient,
  qc: QueryClient,
): Promise<LatLng | null> {
  const fix = geo.isAvailable() ? await withTimeout(geo.getCurrentPosition(), DEVICE_FIX_TIMEOUT_MS) : null
  if (fix) return { lat: fix.latitude, lng: fix.longitude }
  const approximate = await fetchApproximateLocation(api, qc)
  if (approximate) return approximate
  return qc.getQueryData<LatLng | null>(queryKeys.userLocation) ?? null
}

function useApproxCenter(enabled: boolean): LatLng | null {
  const geo = useGeolocation()
  const api = useApi()
  const qc: QueryClient = useQueryClient()
  const [center, setCenter] = useState<LatLng | null>(
    () => qc.getQueryData<LatLng | null>(queryKeys.userLocation) ?? null,
  )
  useEffect(() => {
    if (!enabled || center) return
    const cached = qc.getQueryData<LatLng | null>(queryKeys.userLocation)
    if (cached) {
      setCenter(cached)
      return
    }
    let cancelled = false
    void qc
      .fetchQuery<LatLng | null>({
        queryKey: queryKeys.userLocation,
        queryFn: () => resolveApproxCenter(geo, api, qc),
        staleTime: Infinity,
        gcTime: Infinity,
        retry: false,
      })
      .then(
        (c) => {
          if (!cancelled && c) setCenter(c)
        },
        () => {
        },
      )
    return () => {
      cancelled = true
    }
  }, [geo, api, qc, enabled, center])
  return center
}

function CompactLocationField({
  point,
  onOpenPicker,
  onClear,
}: {
  point: LatLng | null
  onOpenPicker: () => void
  onClear?: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("map-ui")
  const label = useReverseLabel(point)
  const display = point ? reverseLabelText(label.data, point) : null

  return (
    <View style={styles.compactLoc}>
      <Pressable
        onPress={onOpenPicker}
        accessibilityRole="button"
        accessibilityLabel={t("pickStep.openA11y")}
        {...focusRingProps}
        style={({ pressed }) => [styles.compactLocBtn, pressed ? styles.pressed : null]}
      >
        <Icon icon={iconMap.MapPin} size={18} color={th.colors.brand.bloom} />
        <View style={styles.compactLocMeta}>
          {display ? (
            <Text style={styles.compactLocValue} numberOfLines={2}>
              {display}
            </Text>
          ) : (
            <Text style={styles.compactLocPlaceholder} numberOfLines={1}>
              {t("pickStep.open")}
            </Text>
          )}
        </View>
        <Icon icon={point ? iconMap.ChevronRight : iconMap.Plus} size={16} color={th.colors.textMuted} />
      </Pressable>
      {point && onClear ? (
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel={t("actions.reset")}
          hitSlop={6}
          {...focusRingProps}
          style={({ pressed }) => [styles.compactLocClear, pressed ? styles.pressed : null]}
        >
          <Icon icon={iconMap.Close} size={13} color={th.colors.textMuted} />
          <Text style={styles.compactLocClearText}>{t("actions.reset")}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function LocationStep({ onOpenPicker }: { onOpenPicker: () => void }) {
  const styles = useStyles()
  const draft = useDraftReportStore((s) => s.draft)
  const point = draft.lat != null && draft.lng != null ? { lat: draft.lat, lng: draft.lng } : null
  const clearLocation = useDraftReportStore((s) => s.clearLocation)

  return (
    <View style={styles.stepBlock}>
      <CompactLocationField point={point} onOpenPicker={onOpenPicker} onClear={clearLocation} />
    </View>
  )
}

function ReviewStep({
  fromComposer,
  onRequestReveal,
  onOpenPicker,
}: {
  fromComposer: boolean
  onRequestReveal?: (y: number) => void
  onOpenPicker: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-wizard")
  const draft = useDraftReportStore((s) => s.draft)
  const setShareToFeed = useDraftReportStore((s) => s.setShareToFeed)
  const setFeedCaption = useDraftReportStore((s) => s.setFeedCaption)
  const point = draft.lat != null && draft.lng != null ? { lat: draft.lat, lng: draft.lng } : null
  const setLocation = useDraftReportStore((s) => s.setLocation)
  const clearLocation = useDraftReportStore((s) => s.clearLocation)
  const setAddress = useDraftReportStore((s) => s.setAddress)
  const setPrefilledAddress = useDraftReportStore((s) => s.setPrefilledAddress)
  const [addrQuery, setAddrQuery] = useState("")

  const addressResolution = useResolveAddress(point)
  const nearAddress = useCallback((line: string) => t("review.where_near", { address: line }), [t])
  const prefillRef = useRef(setPrefilledAddress)
  prefillRef.current = setPrefilledAddress
  const settledAddress = resolvedAddressValue(addressResolution)
  useEffect(() => {
    const next = reportAddressPrefill({
      hasPoint: point !== null,
      resolution: settledAddress,
      currentAddr: draft.addr,
      addrEdited: draft.addrEdited,
      near: nearAddress,
    })
    if (next !== null) prefillRef.current(next)
  }, [point, settledAddress, draft.addr, draft.addrEdited, nearAddress])
  const layoutMode = useLayoutMode()
  const compact = layoutMode === "compact"
  const pickMode = layoutMode === "expanded" ? "main-map" : "standalone"

  const initialCenter = useApproxCenter(true)

  const onDropPin = useCallback(
    (lat: number, lng: number) => setLocation(lat, lng, "manual"),
    [setLocation],
  )
  const onPickPlace = useCallback(
    (place: AddressPick) => {
      setLocation(place.lat, place.lng, "manual")
      if (pickMode === "main-map") useLocationPick.getState().setDraft(place.lat, place.lng)
    },
    [setLocation, pickMode],
  )
  const jurisdiction = useResolveJurisdiction(point)
  const jd = jurisdiction.data
  const category = draft.category as ReportCategory | null
  const pin = useMemo(() => reportPinTarget(category), [category])

  return (
    <View style={styles.stepBlock}>
      <View style={styles.summaryCard}>
        {category ? <CategoryChip category={category} showLabel size={36} /> : null}
        <Text style={styles.summaryTitle} numberOfLines={2}>
          {draft.title.trim() || t("review.untitled")}
        </Text>
        {draft.description.trim() ? (
          <Text style={styles.summaryDesc} numberOfLines={3}>
            {draft.description.trim()}
          </Text>
        ) : null}
      </View>

      <View style={styles.locationBlock}>
        <Text style={styles.fieldLabel}>{t("review.where_label")}</Text>
        {!point ? (
          <View style={styles.validationRow}>
            <Icon icon={iconMap.AlertCircle} size={15} color={th.colors.brand.bloom} />
            <Text style={styles.errorText}>
              {t("review.no_location")}
            </Text>
          </View>
        ) : null}
        {compact ? (
          <CompactLocationField point={point} onOpenPicker={onOpenPicker} onClear={clearLocation} />
        ) : (
          <>
            <AddressSearch value={addrQuery} onChangeText={setAddrQuery} onPick={onPickPlace} />
            <LocationPicker value={point} onChange={onDropPin} onClear={clearLocation} initialCenter={initialCenter ?? undefined} mode={pickMode} pin={pin} />
          </>
        )}
        <TextField
          placeholder={t("review.where_placeholder")}
          value={draft.addr ?? ""}
          onChangeText={setAddress}
          maxLength={MAX_REPORT_ADDR_LENGTH}
        />
      </View>

      <View style={styles.routeCard}>
        <View style={styles.routeIcon}>
          <Icon icon={iconMap.Building2} size={18} color={th.colors.sky["700"]} />
        </View>
        <View style={styles.routeText}>
          <Text style={styles.routeLabel}>{t("review.route_label")}</Text>
          {!point ? (
            <Text style={styles.routeSub}>{t("review.route_no_point")}</Text>
          ) : jd?.routable ? (
            <>
              <Text style={styles.routeName}>{jd.name}</Text>
              <Text style={styles.routeSub}>{t("review.route_routable")}</Text>
            </>
          ) : jd ? (
            <Text style={styles.routeSub}>
              {t("review.route_new_area", { cityState: jd.cityStateLabel })}
            </Text>
          ) : jurisdiction.data === null ? (
            <Text style={styles.routeSub}>
              {t("review.route_uncovered")}
            </Text>
          ) : (
            <Text style={styles.routeSub}>{t("review.route_resolving")}</Text>
          )}
        </View>
      </View>

      {fromComposer ? null : (
      <FeedShareBlock
        enabled={draft.shareToFeed}
        onToggle={setShareToFeed}
        caption={draft.feedCaption}
        onChangeCaption={setFeedCaption}
        label={t("share.label")}
        helper={t("share.helper")}
        captionPlaceholder={t("share.caption_placeholder")}
        captionA11yLabel={t("share.caption_a11y")}
        nowLabel={t("share.now")}
        onRequestReveal={onRequestReveal}
        attachment={
          <LinkedReportCard
            report={buildReportPreviewCard(draft, t("review.untitled"))}
            layout="list"
            headline="title"
          />
        }
      />
      )}
    </View>
  )
}


interface ShareSnapshot {
  title: string
  category: ReportCategory | null
  addr: string | null
  thumbUrl: string | null
  caption: string
}

function FeedShareOutcomeRow({ outcome, share }: { outcome: FeedShareOutcome; share: ShareSnapshot }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-wizard")
  const me = useMyProfile().data?.profile ?? null
  const retryShare = useFeedShareRetry()
  const [state, setState] = useState<FeedShareOutcome>(outcome)
  const [retrying, setRetrying] = useState(false)
  useEffect(() => setState(outcome), [outcome])

  if (state.status === "skipped") return null

  if (state.status === "posted") {
    const postId = state.postId
    return (
      <View style={styles.sharedBlock}>
        <Text style={styles.sharedHeading}>{t("share.posted_heading")}</Text>
        <FeedSharePreview
          authorName={me?.name ?? ""}
          authorId={me?.id}
          authorPhotoUrl={me?.avatarUrl ?? null}
          authorAvatar={me?.avatar ?? null}
          nowLabel={t("share.now")}
          caption={share.caption}
          footnote={t("share.fixes_hint")}
          onPress={() => {
            useNavStore.getState().finishReportFlow({ kind: "post-thread", id: postId })
          }}
          attachment={
            share.category ? (
              <LinkedReportCard
                report={{
                  id: "shared",
                  category: share.category,
                  title: share.title,
                  status: "published",
                  thumbUrl: share.thumbUrl,
                  addr: share.addr,
                }}
                layout="list"
                headline="title"
              />
            ) : null
          }
        />
      </View>
    )
  }

  const copy =
    state.reason === "rejected"
      ? t("share.failed_rejected")
      : state.reason === "rate-limited"
        ? t("share.failed_rate_limited")
        : t("share.failed")
  const retry = state.retry
  return (
    <View style={styles.shareFailRow}>
      <Icon icon={iconMap.AlertCircle} size={15} color={th.colors.brand.bloom} />
      <Text style={styles.shareFailText}>{copy}</Text>
      {state.retryable ? (
        <PrimaryButton
          label={t("share.retry")}
          variant="outline"
          disabled={retrying}
          onPress={() => {
            setRetrying(true)
            void retryShare(retry)
              .then(setState)
              .finally(() => setRetrying(false))
          }}
        />
      ) : null}
    </View>
  )
}

function SubmitState({
  phase,
  error,
  result,
  share,
  onRetry,
}: {
  phase: "submitting" | "error" | "done"
  error: string | null
  result: ReportSubmitOutcome | null
  share: ShareSnapshot | null
  onRetry: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-wizard")
  const { isAuthenticated } = useAuthState()
  useEffect(() => {
    if (phase === "error") announce(t("submit.announce_error", { detail: error ?? "" }))
  }, [phase, error, t])
  useEffect(() => {
    if (phase === "done") {
      announce(
        result?.status === "held"
          ? t("submit.announce_held")
          : t("submit.announce_live"),
      )
    }
  }, [phase, result, t])

  if (phase === "submitting") {
    return (
      <View style={styles.stateFill}>
        <ActivityIndicator size="large" color={th.colors.brand.bloom} />
        <Text variant="title" style={styles.stateTitle}>
          {t("submit.submitting_title")}
        </Text>
        <Text variant="body" color={th.colors.textMuted} style={styles.stateBody}>
          {t("submit.submitting_body")}
        </Text>
      </View>
    )
  }

  if (phase === "error") {
    return (
      <View style={styles.stateFill}>
        <View style={styles.errorIcon}>
          <Icon icon={iconMap.CloudOff} size={30} color={th.colors.bloom["600"]} />
        </View>
        <Text variant="title" style={styles.stateTitle}>
          {t("submit.error_title")}
        </Text>
        <Text variant="body" color={th.colors.textMuted} style={styles.stateBody}>
          {error}
        </Text>
        <PrimaryButton label={t("submit.try_again")} icon={iconMap.RefreshCw} onPress={onRetry} style={styles.stateCta} />
      </View>
    )
  }

  return (
    <View style={styles.stateFill}>
      <View style={styles.successCheck}>
        <SuccessCheck announce={t("submit.success_title")} />
      </View>
      <Text variant="body" color={th.colors.textMuted} style={styles.stateBody}>
        {result?.status === "held"
          ? t("submit.success_body_held")
          : t("submit.success_body_live")}
      </Text>
      {result && share ? <FeedShareOutcomeRow outcome={result.feedShare} share={share} /> : null}
      {!isAuthenticated ? (
        <Text variant="caption" color={th.colors.textSubtle} style={styles.signedOutHint}>
          {t("share.signed_out_hint")}
        </Text>
      ) : null}
      <View style={styles.successActions}>
        {result ? (
          <PrimaryButton
            label={t("submit.view_report")}
            variant="outline"
            onPress={() => {
              useNavStore.getState().finishReportFlow({
                kind: "pin",
                id: result.reportId,
                lat: result.lat,
                lng: result.lng,
              })
            }}
          />
        ) : null}
        <PrimaryButton label={t("submit.done")} onPress={() => useNavStore.getState().leaveReportFlow()} />
      </View>
    </View>
  )
}


export function ReportFlowBody() {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-wizard")
  const { ScrollView } = useScrollHost()
  const fromComposer = usePostComposerStore((s) => s.claimedCreate) === "report"
  const submit = useReportSubmit({ forComposer: fromComposer })
  const reset = useDraftReportStore((s) => s.reset)
  const mode = useLayoutMode()
  const haptics = useHaptics()
  const Viewfinder = useCamera().Viewfinder ?? null
  const stackNonEmpty = useNavStore((s) => s.stack.length > 0)
  const runActive = useNavStore((s) => s.view === "report")
  const runSurvives = useNavStore((s) => reportRunSurvivesView(s.view))

  useEffect(() => {
    const composer = usePostComposerStore.getState()
    if (runActive) composer.claimPendingCreate("report")
    else if (!runSurvives) composer.releaseClaimedCreate("report")
    return () => deferReportRunRelease(REPORT_RUN_EXIT_HOST)
  }, [runActive, runSurvives])

  const [skipLocationStep] = useState(() => {
    const d = useDraftReportStore.getState().draft
    return d.locationPrefilled && d.lat != null && d.lng != null
  })
  const stepOrder = useMemo(
    () => stepOrderFor(mode, { skipLocation: skipLocationStep }),
    [mode, skipLocationStep],
  )

  const [step, setStep] = useState<Step>(() => resumeStep(useDraftReportStore.getState().draft, mode))
  const [viewfinderMountable, setViewfinderMountable] = useState(false)
  const [submitPhase, setSubmitPhase] = useState<"idle" | "submitting" | "error" | "done">("idle")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<ReportSubmitOutcome | null>(null)
  const [shareSnapshot, setShareSnapshot] = useState<ShareSnapshot | null>(null)
  const scrollRef = useRef<{ scrollTo?: (opts: { y: number; animated?: boolean }) => void } | null>(null)
  const revealShareBlock = useCallback((y: number) => {
    scrollRef.current?.scrollTo?.({ y, animated: true })
  }, [])

  const hasMedia = useDraftReportStore((s) => s.draft.media.length > 0)
  const reportTypeId = useDraftReportStore((s) => s.draft.reportTypeId)
  const title = useDraftReportStore((s) => s.draft.title)
  const hasLocation = useDraftReportStore((s) => s.draft.lat != null && s.draft.lng != null)

  const orphaned = stepOrder.indexOf(step) < 0
  const activeStep = useMemo(
    () => (orphaned ? resumeStep(useDraftReportStore.getState().draft, mode) : step),
    [orphaned, step, mode, hasMedia, hasLocation, reportTypeId, title],
  )
  useEffect(() => {
    if (orphaned) setStep(activeStep)
  }, [orphaned, activeStep])

  const viewfinderVisible = rendersEmbeddedViewfinder(activeStep, hasMedia, Viewfinder != null, mode)

  useEffect(() => {
    const handle = setTimeout(() => setViewfinderMountable(true), VIEWFINDER_MOUNT_DELAY_MS)
    return () => clearTimeout(handle)
  }, [])
  const viewfinderMounted = viewfinderVisible && viewfinderMountable

  const canAdvance = useMemo(() => {
    switch (activeStep) {
      case "capture":
        return hasMedia
      case "location":
        return hasLocation
      case "category":
        return reportTypeId !== null
      case "details":
        return title.trim().length > 0
      case "review":
        return hasLocation
      default:
        return false
    }
  }, [activeStep, hasMedia, reportTypeId, title, hasLocation])

  const stepIndex = Math.max(0, stepOrder.indexOf(activeStep))
  const stepDirection = useStackDirection(stepIndex)
  const stepTitle = t(`wizard.${activeStep}.title`)
  useEffect(() => {
    announce(
      t("wizard.announceStep", {
        current: stepIndex + 1,
        total: stepOrder.length,
        title: stepTitle,
      }),
    )
  }, [stepIndex, stepOrder.length, stepTitle, t])
  const isLast = activeStep === "review"
  const showBack = useNavStore((s) => showBackAffordance({ stack: s.stack, mode, stepIndex }))
  const atViewRoot = stepIndex === 0 && !stackNonEmpty
  const sessionActive = viewfinderSessionActive(activeStep, viewfinderMounted, stackNonEmpty, runActive)
  const sessionResumeGrace = viewfinderResumeGraceEligible(
    activeStep,
    viewfinderMounted,
    stackNonEmpty,
    runActive,
  )

  const onBack = useCallback(() => {
    if (stepIndex <= 0) {
      useNavStore.getState().leaveReportFlow()
      return
    }
    setStep(stepOrder[stepIndex - 1] as Step)
  }, [stepIndex, stepOrder])

  const runSubmit = useCallback(async () => {
    setSubmitPhase("submitting")
    setSubmitError(null)
    try {
      const res = await submit()
      const d = useDraftReportStore.getState().draft
      setShareSnapshot({
        title: d.title.trim() || t("review.untitled"),
        category: (d.category as ReportCategory | null) ?? null,
        addr: d.addr,
        thumbUrl: d.media[0]?.uri ?? null,
        caption: d.feedCaption,
      })

      haptics.success()
      if (fromComposer) {
        const composer = usePostComposerStore.getState()
        composer.setAttachedReport({
          id: res.reportId,
          category: res.category ?? (d.category as ReportCategory | null) ?? "other",
          type: (d.reportTypeId as SharedReportType | undefined) ?? undefined,
          title: d.title.trim() || t("review.untitled"),
          status: res.status ?? "published",
          lat: res.lat,
          lng: res.lng,
          addr: d.addr,
          thumbUrl: d.media[0]?.uri ?? null,
          linkedAt: new Date().toISOString(),
        })
        composer.releaseClaimedCreate("report")
        reset()
        useNavStore.getState().finishReportFlow({ kind: "composer" })
        return
      }

      setResult(res)
      reset()
      setSubmitPhase("done")
    } catch (err) {
      haptics.error()
      setSubmitError(submitErrorMessage(err, t))
      setSubmitPhase("error")
    }
  }, [fromComposer, submit, reset, t, haptics])

  const advanceFromCapture = useCallback(() => {
    setStep(stepAfterCapture(useDraftReportStore.getState().draft, mode, stepOrder))
  }, [mode, stepOrder])

  const onNext = useCallback(() => {
    if (!canAdvance) return
    if (isLast) {
      void runSubmit()
      return
    }
    haptics.selection()
    if (activeStep === "capture") {
      advanceFromCapture()
      return
    }
    setStep(stepOrder[stepIndex + 1] as Step)
  }, [activeStep, advanceFromCapture, canAdvance, haptics, isLast, runSubmit, stepIndex, stepOrder])

  const advanceFromLocation = useCallback(() => {
    setStep((s) => {
      const i = stepOrder.indexOf(s)
      return (stepOrder[i + 1] as Step) ?? s
    })
  }, [stepOrder])
  const cancelLocation = useCallback(() => {
    setStep((s) => {
      const i = stepOrder.indexOf(s)
      return (stepOrder[i - 1] as Step) ?? "capture"
    })
  }, [stepOrder])

  const onViewfinderCaptured = useCallback((media: CapturedMedia) => {
    const store = useDraftReportStore.getState()
    if (store.draft.media.length === 0) store.startFromCapture(media)
    else store.addCapture(media)
  }, [])

  const draftLat = useDraftReportStore((s) => s.draft.lat)
  const draftLng = useDraftReportStore((s) => s.draft.lng)
  const draftCategory = useDraftReportStore((s) => s.draft.category)
  const pickPoint = draftLat != null && draftLng != null ? { lat: draftLat, lng: draftLng } : null
  const pickPin = useMemo(() => reportPinTarget(draftCategory), [draftCategory])
  const [picking, setPicking] = useState(false)
  const pickCenter = useApproxCenter(
    hasMedia || activeStep === "location" || activeStep === "review" || picking,
  )
  const openPicker = useCallback(() => setPicking(true), [])
  useEffect(() => {
    if (activeStep === "location" && !hasLocation) setPicking(true)
  }, [activeStep, hasLocation])
  const onPickConfirm = useCallback(
    (lat: number, lng: number) => {
      useDraftReportStore.getState().setLocation(lat, lng, "manual")
      setPicking(false)
      if (activeStep === "location") advanceFromLocation()
    },
    [activeStep, advanceFromLocation],
  )
  const onPickCancel = useCallback(() => {
    setPicking(false)
    if (activeStep === "location") cancelLocation()
  }, [activeStep, cancelLocation])
  const pickLayerOpen = pickLayerVisible(picking, stackNonEmpty, runActive)
  const pickLayerOffViewHold =
    PICK_LAYER_LINGERS && pickLayerVisible(picking, stackNonEmpty, true) && !runActive
  const [pickLingerArmed, setPickLingerArmed] = useState(false)
  const [seenPickHold, setSeenPickHold] = useState(pickLayerOffViewHold)
  if (seenPickHold !== pickLayerOffViewHold) {
    setSeenPickHold(pickLayerOffViewHold)
    setPickLingerArmed(pickLayerOffViewHold)
  }
  useEffect(() => {
    if (!pickLingerArmed) return
    const handle = setTimeout(() => setPickLingerArmed(false), PICK_LAYER_LINGER_MS)
    return () => clearTimeout(handle)
  }, [pickLingerArmed])
  const pickLayerMounted = pickLayerOpen || (pickLingerArmed && pickLayerOffViewHold)

  if (submitPhase !== "idle") {
    return (
      <View style={styles.root}>
        <SubmitState
          phase={submitPhase}
          error={submitError}
          result={result}
          share={shareSnapshot}
          onRetry={runSubmit}
        />
      </View>
    )
  }

  return (
    <KeyboardPinnedSurface style={styles.root}>
      {wizardHeaderMode(mode, showBack, atViewRoot) === "tab-root" ? (
        <View style={[styles.headerRootRow, mode === "expanded" ? styles.headerRootRowExpanded : null]}>
          <Text style={styles.headerTitleRoot} numberOfLines={1} accessibilityRole="header">
            {t("header.title")}
          </Text>
          <HeaderProfileButton />
        </View>
      ) : (
        <View style={[styles.headerBase, mode === "expanded" ? styles.headerExpanded : styles.headerCompact]}>
          {showBack ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={t("header.back")}
              hitSlop={8}
              {...focusRingProps}
              style={({ pressed }) => [
                styles.backBase,
                mode === "expanded" ? styles.backExpanded : styles.backCompact,
                pressed ? styles.pressed : null,
              ]}
            >
              <Icon icon={iconMap.ArrowLeft} size={DETAIL_BACK_ICON_SIZE} color={th.colors.text} />
            </Pressable>
          ) : null}
          <Text
            style={mode === "expanded" ? styles.headerTitleExpanded : styles.headerTitleCompact}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {t("header.title")}
          </Text>
        </View>
      )}

      <View style={styles.wizardHead}>
        <WizardStepHeader
          step={stepIndex + 1}
          total={stepOrder.length}
          title={stepTitle}
          help={t(`wizard.${activeStep}.help`)}
        />
      </View>

      {viewfinderVisible ? (
        <View style={styles.viewfinderLayer}>
          {viewfinderMounted && Viewfinder ? (
            <Viewfinder
              active={sessionActive}
              resumeGrace={sessionResumeGrace}
              onCaptured={onViewfinderCaptured}
            />
          ) : null}
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            mode === "expanded" && activeStep === "capture" && !hasMedia ? styles.contentFill : null,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepTransition
            transitionKey={activeStep}
            direction={stepDirection}
            style={
              mode === "expanded" && activeStep === "capture" && !hasMedia ? styles.stepHostFill : null
            }
          >
            {activeStep === "capture" ? (
              <CaptureStep mode={mode} />
            ) : null}
            {activeStep === "location" ? (
              <LocationStep onOpenPicker={openPicker} />
            ) : null}
            {activeStep === "category" ? <CategoryStep /> : null}
            {activeStep === "details" ? <DetailsStep /> : null}
            {activeStep === "review" ? (
              <ReviewStep
                fromComposer={fromComposer}
                onRequestReveal={revealShareBlock}
                onOpenPicker={openPicker}
              />
            ) : null}
          </StepTransition>
        </ScrollView>
      )}

      {showsWizardFooter(activeStep, hasMedia) ? (
        <KeyboardPinnedFooter style={styles.footer}>
          <Pressable
            onPress={onNext}
            disabled={!canAdvance}
            accessibilityRole="button"
            accessibilityLabel={isLast ? t("footer.drop_pin") : t("footer.continue")}
            accessibilityState={{ disabled: !canAdvance }}
            {...focusRingProps}
            style={({ pressed }) => [
              styles.nextBtn,
              !canAdvance ? styles.nextDisabled : [styles.nextActive, th.shadows.pin],
              pressed && canAdvance ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.nextText, { color: canAdvance ? th.colors.onAccent : th.colors.textSubtle }]}>
              {isLast ? t("footer.drop_pin") : t("footer.continue")}
            </Text>
            <View style={styles.nextIcon}>
              <Icon
                icon={isLast ? iconMap.MapPin : iconMap.ChevronRight}
                size={16}
                color={canAdvance ? th.colors.onAccent : th.colors.textSubtle}
              />
            </View>
          </Pressable>
        </KeyboardPinnedFooter>
      ) : null}

      <PortraitMapPickStep
        visible={pickLayerMounted}
        inert={!pickLayerOpen}
        presentation="layer"
        value={pickPoint}
        initialCenter={pickCenter}
        onConfirm={onPickConfirm}
        onCancel={onPickCancel}
        pin={pickPin}
      />
    </KeyboardPinnedSurface>
  )
}

const HEADER_PAD_COMPACT = { top: 6, bottom: 12 } as const
const HEADER_PAD_EXPANDED = { top: 14, bottom: 12 } as const

const useStyles = makeThemedStyles((t) => ({
  root: { flex: 1 },
  headerBase: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerCompact: {
    gap: t.space["2"],
    paddingHorizontal: t.space["4"],
    paddingTop: HEADER_PAD_COMPACT.top,
    paddingBottom: HEADER_PAD_COMPACT.bottom,
    minHeight: HEADER_PAD_COMPACT.top + DETAIL_BACK_SIZE + HEADER_PAD_COMPACT.bottom,
  },
  headerExpanded: {
    gap: 10,
    paddingTop: HEADER_PAD_EXPANDED.top,
    paddingHorizontal: 18,
    paddingBottom: HEADER_PAD_EXPANDED.bottom,
    minHeight: HEADER_PAD_EXPANDED.top + DETAIL_BACK_SIZE + HEADER_PAD_EXPANDED.bottom,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  backBase: {
    width: DETAIL_BACK_SIZE,
    height: DETAIL_BACK_SIZE,
    borderRadius: DETAIL_BACK_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  backCompact: {
    marginLeft: -t.space["2"],
  },
  backExpanded: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceTint,
  },
  headerTitleCompact: { ...detailTitleStyle(16, t), flex: 1 },
  headerTitleExpanded: { ...detailTitleStyle(18, t), flex: 1 },
  headerRootRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: HEADER_CONTROL_SIZE,
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["1"],
  },
  headerRootRowExpanded: {
    paddingTop: 14,
    minHeight: 14 + 44 + t.space["1"],
  },
  headerTitleRoot: {
    flex: 1,
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 32,
    lineHeight: 39,
    letterSpacing: -0.5,
    color: t.colors.text,
  },
  scroll: { flex: 1 },
  wizardHead: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["2"],
  },
  viewfinderLayer: {
    flex: 1,
    marginTop: t.space["2"],
    backgroundColor: t.colors.bg,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["8"],
    gap: t.space["4"],
  },
  contentFill: { flexGrow: 1 },
  stepHostFill: { flexGrow: 1 },
  stepBlock: { gap: t.space["3"] },
  stepBlockFill: { flex: 1, justifyContent: "flex-start" },
  fieldLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },

  photoDrop: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 168,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.bloom["700"],
    paddingHorizontal: t.space["6"],
  },
  photoDropFill: { flex: 1, maxHeight: 520 },
  photoDropTitle: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: t.fontSize["16"],
    color: t.colors.neutral.card,
    marginTop: 4,
  },
  photoDropSub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.neutral.card,
    textAlign: "center",
  },
  libraryLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    maxWidth: "100%",
    gap: 6,
    paddingVertical: t.space["2"],
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
  },
  dragHint: {
    textAlign: "center",
    marginTop: -t.space["2"],
  },
  libraryLinkText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  captureActions: {
    flexDirection: "row",
    gap: t.space["3"],
  },
  retakeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  retakeText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.textMuted,
  },
  retakeDisabled: {
    opacity: 0.45,
  },
  captureStrip: {
    flexDirection: "row",
    gap: t.space["2"],
    paddingVertical: t.space["1"],
  },
  captureThumbWrap: {
    width: 96,
    position: "relative",
  },
  captureThumb: {
    borderRadius: t.radius.md,
  },
  captureRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha(t.colors.shadowColor, 0.62),
  },
  captureHint: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
    marginTop: t.space["1"],
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
  },
  compactLocClearText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12,
    color: t.colors.textMuted,
  },

  typeList: { gap: 10 },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    width: "100%",
    padding: 14,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s1,
  },
  glyphCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.neutral.paper2,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  typeMeta: { flex: 1, minWidth: 0 },
  typeTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  typeSub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
    marginTop: 2,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },

  toggles: { gap: t.space["3"] },

  summaryCard: {
    gap: t.space["2"],
    padding: 14,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  summaryTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["16"],
    color: t.colors.text,
  },
  summaryDesc: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
    lineHeight: 18,
  },
  locationBlock: { gap: t.space["2"] },
  routeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: t.colors.sky["50"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.sky["100"],
  },
  routeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.neutral.card,
  },
  routeText: { flex: 1 },
  routeLabel: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: t.colors.sky["700"],
  },
  routeName: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
    marginTop: 1,
  },
  routeSub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
    marginTop: 2,
    lineHeight: 17,
  },

  validationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  errorText: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.accentText,
  },
  hintText: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
    textAlign: "center",
  },

  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["3"],
    paddingBottom: t.space["4"],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
    backgroundColor: t.colors.bg,
  },
  nextBtn: {
    flex: 1,
    height: 50,
    borderRadius: t.radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  nextActive: { backgroundColor: t.colors.brand.bloom },
  nextDisabled: { backgroundColor: t.colors.neutral.ink5 },
  nextText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
  },
  nextIcon: { marginLeft: 6 },
  pressed: { opacity: 0.9 },

  stateFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: t.space["6"],
  },
  stateTitle: { marginTop: t.space["5"], textAlign: "center" },
  stateBody: {
    marginTop: t.space["2"],
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
  stateCta: { marginTop: t.space["6"] },
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: t.colors.bloom["50"],
    alignItems: "center",
    justifyContent: "center",
  },
  successCheck: { marginBottom: t.space["3"] },
  successActions: {
    marginTop: t.space["8"],
    width: "100%",
    maxWidth: 340,
    gap: t.space["3"],
  },

  sharedBlock: {
    marginTop: t.space["6"],
    width: "100%",
    maxWidth: 340,
    gap: t.space["2"],
  },
  sharedHeading: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  shareFailRow: {
    marginTop: t.space["6"],
    width: "100%",
    maxWidth: 340,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  shareFailText: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.accentText,
  },
  signedOutHint: {
    marginTop: t.space["4"],
    width: "100%",
    maxWidth: 340,
    textAlign: "center",
  },
}))
