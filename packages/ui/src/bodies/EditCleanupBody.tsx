import React, { useCallback, useEffect, useMemo, useState } from "react"
import { View, Pressable, ActivityIndicator } from "react-native"
import type { CleanupDTO, UpdateCleanupRequest } from "@civfix/shared"
import { geocodePointKey } from "@civfix/shared"
import { makeThemedStyles, useTheme, noShadow, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import {
  EmptyState,
  SignInPrompt,
  SkeletonBlock,
  SkeletonGroup,
  SkeletonText,
} from "../primitives"
import { useCleanup, useUpdateCleanup, useAuthState, useRequireAuth } from "../data"
import { cleanupHostStanding, managesEvent } from "../data/hooks/host"
import { pathForEntry, useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import { useT, viewerTimeZone } from "../i18n"
import { appErrorCode } from "./errorCode"
import {
  formEndInstantMs,
  formInstantMs,
  isScheduleInFutureInZone,
  isScheduleUntouched,
  wallClockToFormDate,
} from "./calendarModel"
import { wallClockInZone } from "@civfix/shared/datetime"
import { CleanupForm, isCleanupFormComplete, type CleanupFormValue } from "./CleanupForm"
import { composeEventAddress } from "./eventAddressField"
import { linkedRefToCardData, useLinkedReportCards } from "./linkedReportCards"
import { useCleanupDraft } from "./cleanupDraftStore"
import { mustPersistEventEnd, seededEndTime } from "./eventWizard"
import { eventCoverChanged } from "./eventCoverModel"
import { buildSlotInputs, slotsFromCleanup } from "./eventSlotsForm"

type Translate = (key: string, options?: Record<string, unknown>) => string

function saveErrorMessage(err: unknown, t: Translate): string {
  switch (appErrorCode(err)) {
    case "VALIDATION":
      return t("save.error.validation")
    case "RATE_LIMITED":
      return t("save.error.rate_limited")
    case "UNAUTHORIZED":
    case "FORBIDDEN":
      return t("save.error.forbidden")
    default:
      return t("save.error.generic")
  }
}

function formFromCleanup(cleanup: CleanupDTO): CleanupFormValue {
  const timezone = cleanup.timezone ?? viewerTimeZone()
  const when = wallClockToFormDate(wallClockInZone(Date.parse(cleanup.scheduledAt), timezone))
  return {
    organizationId: cleanup.organization?.id ?? null,
    title: cleanup.title,
    description: cleanup.description ?? "",
    eventKind: cleanup.eventKind,
    addrQuery: "",
    spot: "",
    address: cleanup.address ?? "",
    addressSource: cleanup.addressSource ?? (cleanup.address?.trim() ? "manual" : null),
    addressPointKey:
      cleanup.lat != null && cleanup.lng != null
        ? geocodePointKey({ lat: cleanup.lat, lng: cleanup.lng })
        : null,
    coords: cleanup.lat != null && cleanup.lng != null ? { lat: cleanup.lat, lng: cleanup.lng } : null,
    date: when,
    time: when,
    endTime: seededEndTime(cleanup, timezone),
    timezone,
    bring: cleanup.bring ?? [],
    slots: slotsFromCleanup(cleanup.slots),
    linkedReportIds: cleanup.eventKind === "cleanup" ? cleanup.linkedReports.map((r) => r.id) : [],
    shareToFeed: false,
    feedCaption: "",
    coverMediaId: null,
    coverPreviewUrl: cleanup.coverUrl ?? null,
  }
}

function EditForm({ cleanup }: { cleanup: CleanupDTO }) {
  const { ScrollView } = useScrollHost()
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-edit")
  const { t: tForm } = useT("event-form")
  const update = useUpdateCleanup()
  const [form, setForm] = useState<CleanupFormValue>(() => formFromCleanup(cleanup))
  // The cover the form was seeded from. A refetch mid-edit must not turn an untouched cover field into
  // a change: compared against a newer URL, the seeded null would send a delete of a co-host's cover.
  const [seededCoverUrl] = useState(() => cleanup.coverUrl ?? null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const mergeForm = useCallback(
    (partial: Partial<CleanupFormValue>) => setForm((prev) => ({ ...prev, ...partial })),
    [],
  )

  const linkedReports = cleanup.linkedReports
  useEffect(() => {
    useLinkedReportCards.getState().put(linkedReports.map(linkedRefToCardData))
  }, [linkedReports])

  useEffect(
    () => () => {
      // The card cache also backs an in-progress create draft's links; that draft clears it itself.
      if (!useCleanupDraft.getState().active) useLinkedReportCards.getState().clear()
    },
    [],
  )

  const scheduleUntouched =
    form.date != null &&
    form.time != null &&
    isScheduleUntouched(cleanup.scheduledAt, form.date, form.time, form.timezone)

  const persistEventEnd = mustPersistEventEnd(cleanup, form)

  const canSave =
    isCleanupFormComplete(form, cleanup.slots) &&
    (scheduleUntouched ||
      (form.date != null &&
        form.time != null &&
        isScheduleInFutureInZone(form.date, form.time, form.timezone))) &&
    !update.isPending

  const scheduledAt = useMemo(() => {
    if (!form.date || !form.time) return null
    const at = formInstantMs(form.date, form.time, form.timezone)
    return at === null ? null : new Date(at)
  }, [form.date, form.time, form.timezone])

  const endsAt = useMemo(() => {
    if (!form.date || !form.time || !form.endTime) return null
    const at = formEndInstantMs(form.date, form.time, form.endTime, form.timezone)
    return at === null ? null : new Date(at)
  }, [form.date, form.endTime, form.time, form.timezone])

  const onSave = useCallback(() => {
    if (!canSave || !form.coords || !scheduledAt || !endsAt) return
    setSaveError(null)
    const verifiedAddress = composeEventAddress({
      address: form.address,
      addressSource: form.addressSource,
      spot: form.spot,
      near: (line) => tForm("address.near", { address: line }),
    })
    if (!verifiedAddress) return
    const patch: Omit<UpdateCleanupRequest, "id"> = {
      title: form.title.trim(),
      eventKind: form.eventKind,
      lat: form.coords.lat,
      lng: form.coords.lng,
      scheduledAt: scheduleUntouched ? cleanup.scheduledAt : scheduledAt.toISOString(),
      ...(persistEventEnd ? { endsAt: endsAt.toISOString() } : {}),
      ...(form.timezone !== (cleanup.timezone ?? null) ? { timezone: form.timezone } : {}),
      description: form.description.trim(),
      address: verifiedAddress.address,
      addressSource: verifiedAddress.addressSource,
      bring: form.bring,
      slots: buildSlotInputs(form.slots),
      ...(form.organizationId !== (cleanup.organization?.id ?? null)
        ? { organizationId: form.organizationId }
        : {}),
      ...(form.eventKind === "cleanup" ? { linkedReportIds: form.linkedReportIds } : {}),
      ...(eventCoverChanged(form, seededCoverUrl) ? { coverMediaId: form.coverMediaId } : {}),
    }
    update.mutate(
      { id: cleanup.id, patch },
      {
        onSuccess: () => {
          useNavStore.getState().back()
        },
        onError: (err) => setSaveError(saveErrorMessage(err, t)),
      },
    )
  }, [
    canSave,
    cleanup.id,
    cleanup.organization,
    cleanup.scheduledAt,
    cleanup.timezone,
    endsAt,
    form,
    persistEventEnd,
    scheduleUntouched,
    scheduledAt,
    seededCoverUrl,
    update,
    t,
    tForm,
  ])

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <CleanupForm
        value={form}
        onChange={setForm}
        onPatch={mergeForm}
        centerSettled
        initialCenter={form.coords}
        existingSlots={cleanup.slots}
        eventEndUnsaved={cleanup.endsAt == null}
        scheduleUnchanged={scheduleUntouched}
        currentOrganization={cleanup.organization ?? null}
      />

      {saveError ? (
        <View style={styles.validationRow}>
          <Icon icon={iconMap.AlertCircle} size={15} color={th.colors.brand.bloom} />
          <Text style={styles.errorText}>{saveError}</Text>
        </View>
      ) : !canSave && !update.isPending ? (
        <View style={styles.validationRow}>
          <Icon icon={iconMap.Info} size={15} color={th.colors.textSubtle} />
          <Text style={styles.hintText}>{t("validation.incomplete")}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={onSave}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityLabel={t("save.button")}
        {...focusRingProps}
        style={({ pressed }) => [
          styles.saveBtn,
          !canSave ? styles.saveDisabled : null,
          pressed && canSave ? styles.pressed : null,
        ]}
      >
        {update.isPending ? (
          <ActivityIndicator size="small" color={th.colors.onAccent} />
        ) : (
          <Icon icon={iconMap.Check} size={18} color={th.colors.onAccent} />
        )}
        <Text style={styles.saveText}>{update.isPending ? t("save.saving") : t("save.button")}</Text>
      </Pressable>
    </ScrollView>
  )
}

function EditCleanupSkeleton() {
  const { ScrollView } = useScrollHost()
  const styles = useStyles()
  const th = useTheme()
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {SKELETON_FIELDS.map((height, index) => (
        <SkeletonGroup key={index} style={styles.skeletonField}>
          <SkeletonText width="34%" height={11} />
          <SkeletonBlock width="100%" height={height} radius={th.radius.lg} />
        </SkeletonGroup>
      ))}
      <SkeletonBlock width="100%" height={44} radius={th.radius.pill} />
    </ScrollView>
  )
}

export function EditCleanupBody({ id }: { id: string }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-edit")
  const query = useCleanup(id)
  const { user, isAuthenticated, isPending } = useAuthState()
  const requireAuth = useRequireAuth()

  if (isPending || query.isLoading) return <EditCleanupSkeleton />
  if (!isAuthenticated) {
    return (
      <View style={styles.stateFill}>
        <SignInPrompt
          icon={iconMap.Lock}
          tone="neutral"
          variant="detail"
          title={t("signIn.title")}
          body={t("signIn.body")}
          onSignIn={() => requireAuth(() => {}, { next: pathForEntry({ kind: "edit-cleanup", id }) })}
        />
      </View>
    )
  }
  if (query.isError || !query.data) {
    return (
      <View style={styles.stateFill}>
        <EmptyState
          variant="detail"
          tone="neutral"
          icon={iconMap.CloudOff}
          iconColor={th.colors.textSubtle}
          iconSize={30}
          title={t("unavailable.title")}
          body={t("unavailable.body")}
        />
      </View>
    )
  }

  const isHost = managesEvent(cleanupHostStanding(query.data, user?.id ?? null))
  if (!isHost) {
    return (
      <View style={styles.stateFill}>
        <EmptyState
          variant="detail"
          tone="neutral"
          icon={iconMap.Lock}
          iconColor={th.colors.textSubtle}
          iconSize={30}
          title={t("denied.title")}
          body={t("denied.body")}
        />
      </View>
    )
  }

  return <EditForm cleanup={query.data} />
}

const SKELETON_FIELDS = [44, 88, 44, 44, 44] as const

const useStyles = makeThemedStyles((t) => ({
  skeletonField: { gap: t.space["2"] },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
    gap: t.space["4"],
  },
  stateFill: {
    flex: 1,
  },
  validationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
  },
  errorText: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.accentText,
  },
  hintText: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["2"],
    height: 52,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.brand.bloom,
    ...t.shadows.pin,
  },
  saveDisabled: {
    backgroundColor: t.colors.borderStrong,
    ...noShadow,
  },
  saveText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 15,
    color: t.colors.onAccent,
  },
  pressed: {
    opacity: 0.9,
  },
}))
