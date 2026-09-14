import React, { useCallback, useEffect, useState } from "react"
import type { CleanupDTO } from "@civfix/shared"
import { useTheme } from "../../theme"
import { Text } from "../../typography"
import {
  ModalCardSheet,
  PrimaryButton,
  SecondaryButton,
  useToast,
} from "../../primitives"
import { useUpdateCleanup } from "../../data"
import { queryKeys } from "../../data/keys"
import { useQueryClient } from "@tanstack/react-query"
import { useT } from "../../i18n"
import { appErrorCode } from "../errorCode"
import { ReportLinkPicker } from "../ReportLinkPicker"
import { linkedRefToCardData, useLinkedReportCards } from "../linkedReportCards"
import { linkBlockState, sameIdSet, type LinkSheetMode } from "../linkReportsModel"

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
  const saved = cleanup.linkedReports.map((report) => report.id)
  const [ids, setIds] = useState<string[]>(saved)
  const [errorText, setErrorText] = useState<string | null>(null)
  const readonly = mode === "readonly"

  useEffect(() => {
    if (!visible) return
    setIds(cleanup.linkedReports.map((report) => report.id))
    setErrorText(null)
    useLinkedReportCards.getState().put(cleanup.linkedReports.map(linkedRefToCardData))
  }, [visible])

  const dirty = !sameIdSet(ids, saved)

  const onSave = useCallback(() => {
    if (!dirty || update.isPending) return
    setErrorText(null)
    const touched = new Set([...ids, ...saved].filter((id) => !ids.includes(id) || !saved.includes(id)))
    update.mutate(
      { id: cleanup.id, patch: { linkedReportIds: ids } },
      {
        onSuccess: () => {
          for (const id of touched) void qc.invalidateQueries({ queryKey: queryKeys.report(id) })
          toast.show(t("linked_reports_sheet.saved"), { variant: "success" })
          onClose()
        },
        onError: (err) =>
          setErrorText(
            appErrorCode(err) === "FORBIDDEN"
              ? t("linked_reports_sheet.error_forbidden")
              : t("linked_reports_sheet.error"),
          ),
      },
    )
  }, [cleanup.id, dirty, ids, onClose, qc, saved, t, toast, update])

  const center =
    cleanup.lat != null && cleanup.lng != null ? { lat: cleanup.lat, lng: cleanup.lng } : null

  return (
    <ModalCardSheet
      visible={visible}
      onClose={onClose}
      onCommit={readonly ? onClose : onSave}
      headerIcon="MapPin"
      title={t("linked_reports_sheet.title")}
      dismissLabel={t("linked_reports_sheet.dismiss_a11y")}
      backdropDismissDisabled={update.isPending}
      error={errorText}
      bodyLayout="scroll"
      actions={
        readonly ? (
          <PrimaryButton label={t("linked_reports_sheet.close")} onPress={onClose} />
        ) : (
          <>
            <SecondaryButton
              label={t("linked_reports_sheet.cancel")}
              onPress={onClose}
              size="sm"
              disabled={update.isPending}
            />
            <PrimaryButton
              label={t("linked_reports_sheet.save")}
              onPress={onSave}
              loading={update.isPending}
              disabled={!dirty}
            />
          </>
        )
      }
    >
      <Text variant="caption" color={th.colors.textSubtle}>
        {readonly ? t("linked_reports_sheet.caption_readonly") : t("linked_reports_sheet.caption")}
      </Text>

      <ReportLinkPicker
        value={ids}
        onChange={setIds}
        center={center}
        state={linkBlockState({
          isCleanup: cleanup.eventKind === "cleanup",
          hasCoords: center !== null,
          linkedCount: ids.length,
        })}
        readonly={readonly}
      />
    </ModalCardSheet>
  )
}
