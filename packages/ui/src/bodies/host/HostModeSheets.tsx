import React, { useCallback, useState } from "react"
import type { CleanupDTO, EventInsights } from "@civfix/shared"
import { useTheme } from "../../theme"
import { Text } from "../../typography"
import {
  CancelEventSheet,
  ModalCardSheet,
  PrimaryButton,
  SecondaryButton,
  useToast,
} from "../../primitives"
import { RequestResourcesSheet } from "../../primitives/RequestResourcesSheet"
import { useCancelCleanup, useRequestEventResources } from "../../data"
import { useMarkEventNoShows } from "../../data/hooks/host"
import { appErrorCode } from "../../data/errorCode"
import { useT } from "../../i18n"
import type { LinkSheetMode } from "../linkReportsModel"
import { DuplicateEventSheet } from "./dashboard/DuplicateEventSheet"
import { HostWalkupSheet } from "./HostWalkupSheet"
import { LinkedReportsSheet } from "./LinkedReportsSheet"
import { hostedEventFromCleanup } from "./hostSurfaceModel"

export type HostSheetKey = "walkup" | "linking" | "duplicate" | "cancel" | "resources" | "noShows"

type HostSheetsOpen = Readonly<Record<HostSheetKey, boolean>>

const NO_SHEETS_OPEN: HostSheetsOpen = {
  walkup: false,
  linking: false,
  duplicate: false,
  cancel: false,
  resources: false,
  noShows: false,
}

export function useHostSheetsOpen() {
  const [open, setOpen] = useState<HostSheetsOpen>(NO_SHEETS_OPEN)
  const setSheet = useCallback((key: HostSheetKey, value: boolean) => {
    setOpen((current) => (current[key] === value ? current : { ...current, [key]: value }))
  }, [])
  const openSheet = useCallback((key: HostSheetKey) => setSheet(key, true), [setSheet])
  const closeSheet = useCallback((key: HostSheetKey) => setSheet(key, false), [setSheet])
  return { open, openSheet, closeSheet }
}

function cancelErrorKey(err: unknown): string {
  return appErrorCode(err) === "CONFLICT" ? "state.cancel_ended" : "state.cancel_error"
}

// The mutations live in the body, not in HostModeSheets, so a pending cancel, request or no-show mark
// keeps its state and its success callback while the body swaps to a loading or error notice.
export function useHostSheetActions(id: string, closeSheet: (key: HostSheetKey) => void) {
  const { t } = useT("host-mode")
  const toast = useToast()
  const cancelCleanup = useCancelCleanup()
  const requestResources = useRequestEventResources(id)
  const markNoShows = useMarkEventNoShows(id)

  const onConfirmNoShows = useCallback(() => {
    markNoShows.mutate(undefined, {
      onSuccess: (res) => {
        closeSheet("noShows")
        toast.show(t("no_shows.success", { count: res.marked }), { variant: "success" })
      },
      onError: () => toast.show(t("no_shows.error"), { variant: "error" }),
    })
  }, [closeSheet, markNoShows, t, toast])

  const onConfirmCancel = useCallback(
    (reason?: string) => {
      cancelCleanup.mutate(
        { id, ...(reason ? { reason } : {}) },
        { onSuccess: () => closeSheet("cancel") },
      )
    },
    [cancelCleanup, closeSheet, id],
  )

  const onSubmitRequest = useCallback(
    (message: string) => {
      requestResources.mutate({ message }, { onSuccess: () => closeSheet("resources") })
    },
    [closeSheet, requestResources],
  )

  return {
    cancelCleanup,
    requestResources,
    markNoShows,
    onConfirmNoShows,
    onConfirmCancel,
    onSubmitRequest,
  }
}

export type HostSheetActions = ReturnType<typeof useHostSheetActions>

export interface HostModeSheetsProps {
  id: string
  event: CleanupDTO
  insights: EventInsights | null
  unmarked: number
  linkMode: LinkSheetMode
  open: HostSheetsOpen
  onClose: (key: HostSheetKey) => void
  actions: HostSheetActions
}

export function HostModeSheets({
  id,
  event,
  insights,
  unmarked,
  linkMode,
  open,
  onClose,
  actions,
}: HostModeSheetsProps) {
  const th = useTheme()
  const { t } = useT("host-mode")
  const { cancelCleanup, requestResources, markNoShows } = actions

  return (
    <>
      <HostWalkupSheet
        visible={open.walkup}
        cleanupId={id}
        ticketTypes={event.ticketTypes}
        onClose={() => onClose("walkup")}
      />

      <LinkedReportsSheet
        visible={open.linking}
        mode={linkMode === "hidden" ? "readonly" : linkMode}
        cleanup={event}
        onClose={() => onClose("linking")}
      />

      <DuplicateEventSheet
        event={open.duplicate ? hostedEventFromCleanup(event, insights) : null}
        onClose={() => onClose("duplicate")}
      />

      <ModalCardSheet
        visible={open.noShows}
        onClose={() => {
          if (!markNoShows.isPending) onClose("noShows")
        }}
        onCommit={actions.onConfirmNoShows}
        headerIcon="CheckCheck"
        headerIconColor={th.colors.dangerInk}
        title={t("no_shows.title")}
        dismissLabel={t("no_shows.dismiss_a11y")}
        backdropDismissDisabled={markNoShows.isPending}
        actions={
          <>
            <SecondaryButton
              label={t("no_shows.cancel")}
              onPress={() => onClose("noShows")}
              size="sm"
              disabled={markNoShows.isPending}
            />
            <PrimaryButton
              label={t("no_shows.confirm")}
              variant="destructive"
              onPress={actions.onConfirmNoShows}
              loading={markNoShows.isPending}
            />
          </>
        }
      >
        <Text variant="caption">{t("no_shows.body", { count: unmarked })}</Text>
      </ModalCardSheet>

      <CancelEventSheet
        visible={open.cancel}
        pending={cancelCleanup.isPending}
        error={cancelCleanup.isError ? t(cancelErrorKey(cancelCleanup.error)) : null}
        onConfirm={actions.onConfirmCancel}
        onClose={() => {
          if (!cancelCleanup.isPending) onClose("cancel")
        }}
      />

      <RequestResourcesSheet
        visible={open.resources}
        pending={requestResources.isPending}
        error={requestResources.isError ? t("state.resources_error") : null}
        onSubmit={actions.onSubmitRequest}
        onClose={() => {
          if (!requestResources.isPending) onClose("resources")
        }}
      />
    </>
  )
}
