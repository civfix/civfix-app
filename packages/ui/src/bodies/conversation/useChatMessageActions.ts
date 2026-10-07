import { useCallback, useState } from "react"
import { useToast } from "../../primitives"
import type { PollCreateInput } from "../../primitives"
import type { UseChatResult } from "../../data"
import { useT } from "../../i18n"

export function useChatMessageActions({
  createPoll,
  votePoll,
  closePoll,
  setPinned,
  deleteMessage,
}: Pick<UseChatResult, "createPoll" | "votePoll" | "closePoll" | "setPinned"> & {
  deleteMessage: UseChatResult["delete"]
}) {
  const toast = useToast()
  const { t } = useT("conversation")
  const { t: tPolls } = useT("conversation-polls")
  const [pollCreatePending, setPollCreatePending] = useState(false)
  const [pollCreateError, setPollCreateError] = useState<string | null>(null)
  const onCreatePoll = useCallback(
    async (input: PollCreateInput): Promise<boolean> => {
      setPollCreatePending(true)
      setPollCreateError(null)
      try {
        await createPoll(input)
        return true
      } catch {
        setPollCreateError(tPolls("create_error"))
        return false
      } finally {
        setPollCreatePending(false)
      }
    },
    [createPoll, tPolls],
  )
  const onVotePoll = useCallback(
    (messageId: string, optionIdxs: number[]) => {
      void votePoll(messageId, optionIdxs).catch(() => toast.show(tPolls("vote_error"), { variant: "error" }))
    },
    [votePoll, toast, tPolls],
  )
  const onStopPoll = useCallback(
    (messageId: string) => {
      void closePoll(messageId).catch(() => toast.show(tPolls("stop_error"), { variant: "error" }))
    },
    [closePoll, toast, tPolls],
  )
  const onSetPinned = useCallback(
    (messageId: string, pinned: boolean) => {
      void setPinned(messageId, pinned).catch(() => {
        toast.show(t("pins.action_failed"), { variant: "error" })
      })
    },
    [setPinned, toast, t],
  )
  const onDeleteMessage = useCallback(
    (messageId: string) => {
      void deleteMessage(messageId).catch(() => {
        toast.show(t("menu.delete_failed"), { variant: "error" })
      })
    },
    [deleteMessage, toast, t],
  )
  return { pollCreatePending, pollCreateError, onCreatePoll, onVotePoll, onStopPoll, onSetPinned, onDeleteMessage }
}
