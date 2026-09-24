import React, { useCallback, useState } from "react"
import type { HostedEventDTO } from "@civfix/shared"
import { useTheme } from "../../../theme"
import { Text } from "../../../typography"
import { ModalCardSheet, PrimaryButton, SecondaryButton, useToast } from "../../../primitives"
import { useT, viewerTimeZone } from "../../../i18n"
import { useNavStore } from "../../../nav"
import { useDuplicateCleanup } from "../../../data/hooks/cleanups"
import { InlineDateTimePicker } from "../../InlineDateTimePicker"
import { TimezoneField } from "../../TimezoneField"
import { formInstantMs, mergeDateTime, wallClockToFormDate } from "../../calendarModel"
import { appErrorCode } from "@civfix/shared"
import { duplicateErrorKey, duplicateReady, nextDuplicateStart } from "./dashboardModel"

export interface DuplicateEventSheetProps {
  event: HostedEventDTO | null
  onClose: () => void
}

export function DuplicateEventSheet({ event, onClose }: DuplicateEventSheetProps) {
  const th = useTheme()
  const { t } = useT("event-dashboard")
  const toast = useToast()
  const duplicate = useDuplicateCleanup()

  const [date, setDate] = useState<Date | null>(null)
  const [time, setTime] = useState<Date | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [seededFor, setSeededFor] = useState<string | null>(null)

  const timeZone = event?.timezone ?? viewerTimeZone()

  // Seeds once per open, keyed on the event id: callers may rebuild the DTO on every render, and
  // re-seeding on identity would wipe the host's picks mid-edit.
  const eventId = event?.id ?? null
  if (eventId !== seededFor) {
    setSeededFor(eventId)
    if (event) {
      const seed = wallClockToFormDate(
        nextDuplicateStart(event.startsAt, event.timezone, new Date()).wallClock,
      )
      setDate(seed)
      setTime(seed)
      setErrorText(null)
    }
  }

  const onClosed = useCallback(() => {
    if (!duplicate.isPending) duplicate.reset()
  }, [duplicate])

  const busy = duplicate.isPending
  const ready = duplicateReady(date, time, timeZone, new Date())

  const submit = useCallback(() => {
    if (!event || !date || !time || busy) return
    const at = formInstantMs(date, time, timeZone)
    if (at === null || !duplicateReady(date, time, timeZone, new Date())) {
      setErrorText(t("events.duplicate_past"))
      return
    }
    setErrorText(null)
    duplicate.mutate(
      {
        id: event.id,
        scheduledAt: new Date(at).toISOString(),
        includeTicketTypes: true,
        includeQuestions: true,
        includePage: false,
      },
      {
        onSuccess: (created) => {
          toast.show(t("events.duplicate_created"), { variant: "success" })
          onClose()
          useNavStore.getState().push({ kind: "edit-cleanup", id: created.id })
        },
        onError: (err) => {
          const message = t(duplicateErrorKey(appErrorCode(err)))
          setErrorText(message)
          toast.show(message, { variant: "error" })
        },
      },
    )
  }, [busy, date, duplicate, event, onClose, t, time, timeZone, toast])

  return (
    <ModalCardSheet
      visible={event !== null}
      onClose={onClose}
      onClosed={onClosed}
      onCommit={submit}
      headerIcon="Copy"
      headerIconColor={th.colors.sky["700"]}
      title={t("events.duplicate_title")}
      dismissLabel={t("events.duplicate_dismiss_a11y")}
      backdropDismissDisabled={busy}
      error={errorText}
      actions={
        <>
          <SecondaryButton label={t("common:cancel")} onPress={onClose} size="sm" disabled={busy} />
          <PrimaryButton
            label={t("events.duplicate_confirm")}
            onPress={submit}
            loading={busy}
            disabled={!ready || busy}
          />
        </>
      }
    >
      <Text variant="caption" color={th.colors.textSubtle}>
        {t("events.duplicate_hint")}
      </Text>
      <InlineDateTimePicker
        date={date}
        time={time}
        timeZone={timeZone}
        onDateChange={(next) => {
          setDate(next)
          setTime((current) => (current ? mergeDateTime(next, current) : current))
        }}
        onTimeChange={setTime}
      />
      <TimezoneField value={timeZone} />
    </ModalCardSheet>
  )
}
