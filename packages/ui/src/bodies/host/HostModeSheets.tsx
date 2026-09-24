import React from "react"
import type { CleanupDTO, EventInsights } from "@civfix/shared"
import { useTheme } from "../../theme"
import { Text } from "../../typography"
import {
  CancelEventSheet,
  ModalCardSheet,
  PrimaryButton,
  SecondaryButton,
} from "../../primitives"
import { RequestResourcesSheet } from "../../primitives/RequestResourcesSheet"
import { appErrorCode } from "../../data/errorCode"
import { useT } from "../../i18n"
import type { LinkSheetMode } from "../linkReportsModel"
import { DuplicateEventSheet } from "./dashboard/DuplicateEventSheet"
import { HostWalkupSheet } from "./HostWalkupSheet"
import { LinkedReportsSheet } from "./LinkedReportsSheet"
import { hostedEventFromCleanup } from "./hostSurfaceModel"
import type { HostSheetKey, HostSheetsOpen } from "./useHostSheetsOpen"
import type { HostSheetActions } from "./useHostSheetActions"

function cancelErrorKey(err: unknown): string {
  return appErrorCode(err) === "CONFLICT" ? "state.cancel_ended" : "state.cancel_error"
}

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
