import React, { useCallback, useEffect, useMemo, useState } from "react"
import type { CleanupDTO } from "@civfix/shared"
import { useQueryClient } from "@tanstack/react-query"
import { useTheme } from "../../theme"
import { Text } from "../../typography"
import { ModalCardSheet, PrimaryButton, useToast } from "../../primitives"
import { useUpdateCleanup } from "../../data"
import { queryKeys } from "../../data/keys"
import { useT } from "../../i18n"
import { ErrorCode, appErrorCode } from "@civfix/shared"
import { ReportLinkPicker } from "../ReportLinkPicker"
import { ReportPicker } from "../reportPicker/ReportPicker"
import { optimisticLinkedRefs, refToPin } from "../reportPicker/reportPickerModel"
import { linkedRefToCardData, useLinkedReportCards } from "../linkedReportCards"
import { linkBlockState, linkedReportsPatch, type LinkSheetMode } from "../linkReportsModel"

export interface LinkedReportsSheetProps {
  visible: boolean
  mode: LinkSheetMode
  cleanup: CleanupDTO
  onClose: () => void
}

export function LinkedReportsSheet({ visible, mode, cleanup, onClose }: LinkedReportsSheetProps) {
  const th = useTheme()
  const { t } = useT("host-mode")
  const toast = useToast()
  const qc = useQueryClient()
  const update = useUpdateCleanup()
  const saved = useMemo(() => cleanup.linkedReports.map((report) => report.id), [cleanup.linkedReports])
  const linkedPins = useMemo(() => cleanup.linkedReports.map(refToPin), [cleanup.linkedReports])
  const [errorText, setErrorText] = useState<string | null>(null)
  const [shown, setShown] = useState(visible)
  const readonly = mode === "readonly"

  if (visible !== shown) {
    setShown(visible)
    if (visible) setErrorText(null)
  }

  useEffect(() => {
    if (!visible) return
    useLinkedReportCards.getState().put(cleanup.linkedReports.map(linkedRefToCardData))
  }, [visible, cleanup.linkedReports])

  const onSave = useCallback(
    (ids: string[]) => {
      if (update.isPending) return
      setErrorText(null)
      const touched = new Set(
        [...ids, ...saved].filter((id) => !ids.includes(id) || !saved.includes(id)),
      )
      const linkedReports = optimisticLinkedRefs(
        ids,
        cleanup.linkedReports,
        useLinkedReportCards.getState().cards,
        new Date().toISOString(),
      )
      update.mutate(
        { id: cleanup.id, patch: linkedReportsPatch(ids), linkedReports },
        {
          onSuccess: () => {
            for (const id of touched) void qc.invalidateQueries({ queryKey: queryKeys.report(id) })
            toast.show(t("linked_reports_sheet.saved"), { variant: "success" })
            onClose()
          },
          onError: (err) => {
            setErrorText(
              appErrorCode(err) === ErrorCode.FORBIDDEN
                ? t("linked_reports_sheet.error_forbidden")
                : t("linked_reports_sheet.error"),
            )
          },
        },
      )
    },
    [cleanup.id, cleanup.linkedReports, onClose, qc, saved, t, toast, update],
  )

  const center = useMemo(
    () => (cleanup.lat != null && cleanup.lng != null ? { lat: cleanup.lat, lng: cleanup.lng } : null),
    [cleanup.lat, cleanup.lng],
  )

  if (!readonly && center) {
    return (
      <ReportPicker
        visible={visible}
        mode="commit"
        center={center}
        value={saved}
        linked={linkedPins}
        onCommit={onSave}
        onClose={onClose}
        busy={update.isPending}
        error={errorText}
      />
    )
  }

  return (
    <ModalCardSheet
      visible={visible}
      onClose={onClose}
      onCommit={onClose}
      headerIcon="MapPin"
      title={t("linked_reports_sheet.title")}
      dismissLabel={t("linked_reports_sheet.dismiss_a11y")}
      bodyLayout="scroll"
      actions={<PrimaryButton label={t("linked_reports_sheet.close")} onPress={onClose} />}
    >
      <Text variant="caption" color={th.colors.textSubtle}>
        {t(readonly ? "linked_reports_sheet.caption_readonly" : "linked_reports_sheet.caption_pin_first")}
      </Text>

      {visible ? (
        <ReportLinkPicker
          value={saved}
          onChange={() => undefined}
          center={center}
          state={linkBlockState({
            isCleanup: cleanup.eventKind === "cleanup",
            hasCoords: center !== null,
            linkedCount: saved.length,
          })}
          readonly
        />
      ) : null}
    </ModalCardSheet>
  )
}
