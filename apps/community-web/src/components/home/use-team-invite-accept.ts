"use client"

import * as React from "react"
import { AcceptEventTeamInviteRequestSchema, ErrorCode, toAppError } from "@civfix/shared"
import { useToast } from "@civfix/ui"
import { useAcceptEventTeamInvite, useAuthState } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import {
  clearStashedTeamInvite,
  readStashedTeamInvite,
  stashTeamInvite,
  takeTeamInviteFromUrl,
  type EventTeamInviteLink,
} from "@/lib/team-invite"

const TERMINAL_CODES: readonly string[] = [
  ErrorCode.NOT_FOUND,
  ErrorCode.CONFLICT,
  ErrorCode.FORBIDDEN,
  ErrorCode.VALIDATION,
]

function problemKey(code: string): string {
  if (code === ErrorCode.NOT_FOUND) return "accept.error_invalid"
  if (code === ErrorCode.CONFLICT) return "accept.error_unavailable"
  if (code === ErrorCode.FORBIDDEN) return "accept.error_removed"
  return "accept.error_generic"
}

export function useTeamInviteAccept(): void {
  const [link, setLink] = React.useState<EventTeamInviteLink | null>(null)
  const { isAuthenticated } = useAuthState()
  const accept = useAcceptEventTeamInvite(link?.cleanupId ?? "")
  const acceptMutate = accept.mutate
  const toast = useToast()
  const { t } = useT("host-team")
  const attempted = React.useRef(false)

  React.useLayoutEffect(() => {
    const taken = takeTeamInviteFromUrl()
    if (taken !== null) stashTeamInvite(taken)
    setLink(taken ?? readStashedTeamInvite())
  }, [])

  React.useEffect(() => {
    if (link === null || !isAuthenticated || attempted.current) return
    if (!AcceptEventTeamInviteRequestSchema.safeParse({ id: link.cleanupId, token: link.token }).success) {
      clearStashedTeamInvite()
      return
    }
    attempted.current = true
    acceptMutate(
      { token: link.token },
      {
        onSuccess: (result) => {
          clearStashedTeamInvite()
          const role = t(`role.${result.role}`, { defaultValue: result.role })
          toast.show(t("accept.joined", { role }), { variant: "success" })
        },
        onError: (err: unknown) => {
          const code = toAppError(err).code
          if (TERMINAL_CODES.includes(code)) clearStashedTeamInvite()
          toast.show(t(problemKey(code)), { variant: "error" })
        },
      },
    )
  }, [link, isAuthenticated, acceptMutate, t, toast])
}
