import { useCallback, useState } from "react"
import type { CheckinResultDTO } from "@civfix/shared"
import { normalizeTicketCode, ticketCodeReady } from "@civfix/shared/host"
import { useToast } from "../../../primitives"
import { presentScanner } from "../../../primitives/scannerPresenter"
import { useHaptics } from "../../../capabilities"
import { useScanEventTicket, useUndoEventCheckIn } from "../../../data/hooks/host"
import { appErrorCode } from "../../../data/errorCode"
import { useT } from "../../../i18n"
import { useCheckinOutbox } from "../useCheckinOutbox"

export interface CheckinResultState {
  result: CheckinResultDTO
  seatId: string | null
}

export function useCheckinDesk(id: string) {
  const { t } = useT("host-checkin")
  const haptics = useHaptics()
  const toast = useToast()

  const scan = useScanEventTicket(id)
  const undo = useUndoEventCheckIn(id)
  const outbox = useCheckinOutbox(id)

  const [code, setCode] = useState("")
  const [codeFocused, setCodeFocused] = useState(false)
  const [state, setState] = useState<CheckinResultState | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)

  const submitToken = useCallback(
    (token: string) => {
      setErrorText(null)
      scan.mutate(
        { token },
        {
          onSuccess: (result) => {
            setState({ result, seatId: result.seat?.id ?? null })
            setCode("")
            if (result.outcome === "checked_in" && result.firstTime) haptics.success()
            else haptics.error()
          },
          onError: (err) => {
            const codeName = appErrorCode(err)
            if (codeName === undefined || codeName === "INTERNAL" || codeName === "RATE_LIMITED") {
              outbox.queue({ method: "scan", token })
              setCode("")
              toast.show(t("outbox.queued"), { variant: "info" })
              return
            }
            setErrorText(t("error.generic"))
          },
        },
      )
    },
    [haptics, outbox, scan, t, toast],
  )

  const onScan = useCallback(() => {
    void presentScanner().then((token) => {
      if (token) submitToken(token)
    })
  }, [submitToken])

  const onSubmitCode = useCallback(() => {
    const value = normalizeTicketCode(code)
    if (!ticketCodeReady(value)) {
      setErrorText(t("error.code_length"))
      return
    }
    submitToken(value)
  }, [code, submitToken, t])

  const onUndo = useCallback(() => {
    const seatId = state?.seatId
    if (!seatId) return
    undo.mutate(
      { seatId },
      {
        onSuccess: () => {
          setState(null)
          toast.show(t("result.undo_done"), { variant: "success" })
        },
        onError: () => setErrorText(t("error.generic")),
      },
    )
  }, [state?.seatId, t, toast, undo])

  const dismissResult = useCallback(() => setState(null), [])

  return {
    scan,
    undo,
    outbox,
    code,
    setCode,
    codeFocused,
    setCodeFocused,
    state,
    errorText,
    onScan,
    onSubmitCode,
    onUndo,
    dismissResult,
  }
}
