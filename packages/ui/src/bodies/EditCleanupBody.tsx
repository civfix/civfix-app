import React, { useCallback, useEffect, useMemo, useState } from "react"
import { View, Pressable, ActivityIndicator } from "react-native"
import type { CleanupDTO, UpdateCleanupRequest } from "@civfix/shared"
import { makeThemedStyles, useTheme, noShadow, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import {
  EmptyState,
  SkeletonBlock,
  SkeletonGroup,
  SkeletonText,
} from "../primitives"
import { useCleanup, useUpdateCleanup, useAuthState } from "../data"
import { cleanupHostStanding, managesEvent } from "../data/hooks/host"
import { useNavStore } from "../nav"
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
import { linkedRefToCardData, useLinkedReportCards } from "./linkedReportCards"
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
    spot: cleanup.address ?? "",
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
  const update = useUpdateCleanup()
  const [form, setForm] = useState<CleanupFormValue>(() => formFromCleanup(cleanup))
  const [saveError, setSaveError] = useState<string | null>(null)

  const linkedReports = cleanup.linkedReports
  const linkedReportIds = linkedReports.map((report) => report.id).join(",")
  useEffect(() => {
    useLinkedReportCards.getState().put(linkedReports.map(linkedRefToCardData))
  }, [linkedReportIds])

  useEffect(() => () => useLinkedReportCards.getState().clear(), [])

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
    const spotLine = form.spot.trim().slice(0, 200)
    const patch: Omit<UpdateCleanupRequest, "id"> = {
      title: form.title.trim(),
      eventKind: form.eventKind,
      lat: form.coords.lat,
      lng: form.coords.lng,
      scheduledAt: scheduleUntouched ? cleanup.scheduledAt : scheduledAt.toISOString(),
      ...(persistEventEnd ? { endsAt: endsAt.toISOString() } : {}),
      ...(form.timezone !== (cleanup.timezone ?? null) ? { timezone: form.timezone } : {}),
      description: form.description.trim(),
      address: spotLine,
      bring: form.bring,
      slots: buildSlotInputs(form.slots),
      ...(form.organizationId !== (cleanup.organization?.id ?? null)
        ? { organizationId: form.organizationId }
        : {}),
      ...(form.eventKind === "cleanup" ? { linkedReportIds: form.linkedReportIds } : {}),
      ...(eventCoverChanged(form, cleanup.coverUrl) ? { coverMediaId: form.coverMediaId } : {}),
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
    update,
    t,
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
  const { user } = useAuthState()

  if (query.isLoading) return <EditCleanupSkeleton />
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
