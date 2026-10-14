import { useCallback, useRef, useState } from "react"
import type { CreateChatGroupRequest } from "@civfix/shared"
import { useCreateGroup } from "../data"
import { useNavStore } from "../nav"
import { stackOpeningGroup } from "./groupWizard"

export interface CreateGroupAndOpen {
  submit: (ready: boolean, request: CreateChatGroupRequest) => void
  pending: boolean
  submitError: boolean
}

export function useCreateGroupAndOpen(): CreateGroupAndOpen {
  const createGroup = useCreateGroup()
  const [submitError, setSubmitError] = useState(false)
  /** Claimed synchronously: `isPending` lags a same-frame double activation (double click, key repeat). */
  const submittingRef = useRef(false)

  const submit = useCallback(
    (ready: boolean, request: CreateChatGroupRequest) => {
      if (submittingRef.current) return
      if (!ready || createGroup.isPending) return
      submittingRef.current = true
      setSubmitError(false)
      createGroup.mutate(request, {
        onSuccess: (group) => {
          const nav = useNavStore.getState()
          nav.setStack(stackOpeningGroup(nav.stack, group))
        },
        onError: () => setSubmitError(true),
        onSettled: () => {
          submittingRef.current = false
        },
      })
    },
    [createGroup],
  )

  return { submit, pending: createGroup.isPending, submitError }
}
