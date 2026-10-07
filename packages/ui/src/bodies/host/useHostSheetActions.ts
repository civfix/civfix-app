import { useCallback } from "react"
import { useToast } from "../../primitives"
import { useCancelCleanup, useRequestEventResources } from "../../data"
import { useMarkEventNoShows } from "../../data/hooks/host"
import { useT } from "../../i18n"
import type { HostSheetKey } from "./useHostSheetsOpen"

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
