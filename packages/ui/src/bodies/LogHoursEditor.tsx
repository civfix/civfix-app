import React, { useCallback, useMemo, useState } from "react"
import { View, Pressable, ActivityIndicator } from "react-native"
import type { AttendeeDTO, EventHoursResponse } from "@civfix/shared"
import { MAX_EVENT_HOURS } from "@civfix/shared"
import { makeThemedStyles, useTheme, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { Avatar, TextField, useToast } from "../primitives"
import { useAuthState, useCleanupAttendees, useLogEventHours } from "../data"
import { useRelativeTime, useT } from "../i18n"
import { buildHoursEntries, hoursDraftValid, seedHoursDrafts } from "./hoursEntries"

export type LoggedHoursEntry = EventHoursResponse["entries"][number]

export interface LogHoursEditorProps {
  cleanupId: string
  initialEntries?: readonly LoggedHoursEntry[]
  openOnMount?: boolean
  onClose?: () => void
}

export function LogHoursEditor({
  cleanupId,
  initialEntries,
  openOnMount = false,
  onClose,
}: LogHoursEditorProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-detail")
  const { relative } = useRelativeTime()
  const { user } = useAuthState()
  const toast = useToast()
  const logHours = useLogEventHours()
  const attendeesQuery = useCleanupAttendees(cleanupId)
  const roster: AttendeeDTO[] = useMemo(
    () => attendeesQuery.data?.attendees ?? [],
    [attendeesQuery.data],
  )
  const viewerId = user?.id
  const attendees = useMemo(
    () => (viewerId ? roster.filter((a) => a.id !== viewerId) : roster),
    [roster, viewerId],
  )
  const viewerOnRoster = !!viewerId && roster.some((a) => a.id === viewerId)

  const seeded = useMemo(() => seedHoursDrafts(initialEntries ?? []), [initialEntries])
  const hasLoggedRows = (initialEntries?.length ?? 0) > 0
  const loggedAtById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const entry of initialEntries ?? []) map[entry.userId] = entry.loggedAt
    return map
  }, [initialEntries])

  const [open, setOpen] = useState(openOnMount)
  const [defaultHoursDraft, setDefaultHoursDraft] = useState("")
  const [hoursDrafts, setHoursDrafts] = useState<Record<string, string>>(seeded)

  const defaultDraftValid = hoursDraftValid(defaultHoursDraft, MAX_EVENT_HOURS)
  const anyRowInvalid = attendees.some(
    (a) => !hoursDraftValid(hoursDrafts[a.id] ?? "", MAX_EVENT_HOURS),
  )
  const entries = useMemo(
    () =>
      buildHoursEntries(
        attendees.map((a) => a.id),
        hoursDrafts,
        MAX_EVENT_HOURS,
      ),
    [attendees, hoursDrafts],
  )

  const onOpen = useCallback(() => {
    setDefaultHoursDraft("")
    setHoursDrafts(seeded)
    setOpen(true)
  }, [seeded])
  const onCancel = useCallback(() => {
    if (logHours.isPending) return
    setOpen(false)
    onClose?.()
  }, [logHours.isPending, onClose])
  const onApplyDefault = useCallback(() => {
    if (defaultHoursDraft.trim().length === 0 || !defaultDraftValid) return
    setHoursDrafts(Object.fromEntries(attendees.map((a) => [a.id, defaultHoursDraft])))
  }, [defaultHoursDraft, defaultDraftValid, attendees])
  const onChangeRow = useCallback((userId: string, value: string) => {
    setHoursDrafts((prev) => ({ ...prev, [userId]: value }))
  }, [])
  const onSubmit = useCallback(() => {
    if (!entries) return
    logHours.mutate(
      { id: cleanupId, entries },
      {
        onSuccess: (res) => {
          setOpen(false)
          setDefaultHoursDraft("")
          setHoursDrafts({})
          toast.show(t("log_hours.success_toast", { count: res.credited }), { variant: "success" })
          onClose?.()
        },
        onError: () => {
          toast.show(t("log_hours.error_toast"), { variant: "error" })
        },
      },
    )
  }, [entries, logHours, cleanupId, toast, t, onClose])

  if (!open) {
    return (
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={t("log_hours.action_a11y")}
        {...focusRingProps}
        style={({ pressed }) => [styles.openBtn, pressed ? styles.pressed : null]}
      >
        <Icon icon={iconMap.Clock} size={16} color={th.colors.sky["700"]} />
        <Text style={styles.openBtnText}>{t("log_hours.action")}</Text>
      </Pressable>
    )
  }

  return (
    <View style={styles.editor}>
      <View style={styles.defaultRow}>
        <TextField
          containerStyle={styles.defaultField}
          label={t("log_hours.default_label")}
          placeholder={t("log_hours.placeholder")}
          keyboardType="decimal-pad"
          value={defaultHoursDraft}
          onChangeText={setDefaultHoursDraft}
          editable={!logHours.isPending}
          accessibilityLabel={t("log_hours.default_a11y")}
        />
        <Pressable
          onPress={onApplyDefault}
          disabled={logHours.isPending || defaultHoursDraft.trim().length === 0 || !defaultDraftValid}
          accessibilityRole="button"
          accessibilityLabel={t("log_hours.apply_all_a11y")}
          {...focusRingProps}
          style={({ pressed }) => [
            styles.applyBtn,
            defaultHoursDraft.trim().length === 0 || !defaultDraftValid ? styles.saveDisabled : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.applyText}>{t("log_hours.apply_all")}</Text>
        </Pressable>
      </View>
      {attendees.length === 0 ? (
        <Text style={styles.hint}>
          {attendeesQuery.isLoading ? t("log_hours.loading_roster") : t("log_hours.empty_roster")}
        </Text>
      ) : (
        attendees.map((a) => {
          const draft = hoursDrafts[a.id] ?? ""
          const rowInvalid = !hoursDraftValid(draft, MAX_EVENT_HOURS)
          const loggedAt = loggedAtById[a.id]
          return (
            <View key={a.id} style={styles.row}>
              <Avatar
                name={a.name}
                seed={a.id}
                photoUrl={a.avatarUrl ?? null}
                gradient={a.avatar ?? null}
                size={28}
              />
              <View style={styles.rowMain}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {a.name}
                </Text>
                {loggedAt ? (
                  <Text style={styles.rowLogged} numberOfLines={1}>
                    {t("log_hours.row_logged", { ago: relative(loggedAt) })}
                  </Text>
                ) : null}
              </View>
              <TextField
                containerStyle={styles.rowField}
                placeholder={t("log_hours.row_placeholder")}
                keyboardType="decimal-pad"
                value={draft}
                onChangeText={(v) => onChangeRow(a.id, v)}
                editable={!logHours.isPending}
                accessibilityLabel={t("log_hours.row_a11y", { name: a.name })}
              />
              {rowInvalid ? (
                <Icon icon={iconMap.AlertCircle} size={15} color={th.colors.bloom["700"]} />
              ) : null}
            </View>
          )
        })
      )}
      {anyRowInvalid ? (
        <Text style={styles.error}>{t("log_hours.invalid", { max: MAX_EVENT_HOURS })}</Text>
      ) : null}
      {attendees.length > 0 ? (
        <Text style={styles.blankHint}>
          {hasLoggedRows ? t("log_hours.blank_hint_edit") : t("log_hours.blank_hint")}
        </Text>
      ) : null}
      {viewerOnRoster ? <Text style={styles.blankHint}>{t("log_hours.self_note")}</Text> : null}
      <View style={styles.actions}>
        <Pressable
          onPress={onCancel}
          disabled={logHours.isPending}
          accessibilityRole="button"
          accessibilityLabel={t("log_hours.cancel_a11y")}
          {...focusRingProps}
          style={({ pressed }) => [styles.btn, pressed ? styles.pressed : null]}
        >
          <Text style={styles.cancelText}>{t("log_hours.cancel")}</Text>
        </Pressable>
        <Pressable
          onPress={onSubmit}
          disabled={logHours.isPending || !entries}
          accessibilityRole="button"
          accessibilityLabel={t("log_hours.save_a11y")}
          {...focusRingProps}
          style={({ pressed }) => [
            styles.btn,
            styles.save,
            logHours.isPending || !entries ? styles.saveDisabled : null,
            pressed && !!entries && !logHours.isPending ? styles.pressed : null,
          ]}
        >
          {logHours.isPending ? (
            <ActivityIndicator size="small" color={th.colors.onAccent} />
          ) : (
            <Text style={styles.saveText}>{t("log_hours.save")}</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  openBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["2"],
    marginTop: t.space["3"],
    paddingVertical: t.space["3"],
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.sky["50"],
    borderWidth: 1.5,
    borderColor: t.colors.sky["100"],
  },
  openBtnText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 14,
    color: t.colors.sky["700"],
  },
  editor: {
    marginTop: t.space["3"],
    gap: t.space["2"],
  },
  defaultRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: t.space["2"],
  },
  defaultField: {
    flex: 1,
    marginBottom: 0,
  },
  applyBtn: {
    height: 44,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  applyText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 13,
    color: t.colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 13.5,
    color: t.colors.text,
  },
  rowLogged: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 11,
    color: t.colors.textSubtle,
  },
  rowField: {
    width: 86,
    marginBottom: 0,
  },
  hint: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    color: t.colors.textSubtle,
  },
  blankHint: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textSubtle,
  },
  error: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12,
    color: t.colors.bloom["700"],
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: t.space["2"],
  },
  btn: {
    height: 38,
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
    color: t.colors.textMuted,
  },
  save: {
    minWidth: 96,
    backgroundColor: t.colors.brand.bloom,
  },
  saveDisabled: {
    opacity: 0.5,
  },
  saveText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
    color: t.colors.neutral.card,
  },
  pressed: {
    opacity: 0.85,
  },
}))
