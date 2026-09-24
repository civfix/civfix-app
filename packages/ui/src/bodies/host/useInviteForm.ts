import { useCallback, useState } from "react"
import type { TFunction } from "i18next"
import { useToast } from "../../primitives"
import { appErrorCode } from "../../data/errorCode"
import { inviteIdentifierValue } from "./hostTeamModel"
import type { InviteIdentifierKind } from "./InviteIdentifierFields"

export interface InviteMutation<Role> {
  isPending: boolean
  reset(): void
  mutate(
    variables: { identifierKind: InviteIdentifierKind; identifier: string; role: Role },
    options: { onSuccess: () => void; onError: (err: unknown) => void },
  ): void
}

export interface InviteFormOptions<Role> {
  invite: InviteMutation<Role>
  defaultRole: Role
  t: TFunction
  identifierErrorKey: (kind: InviteIdentifierKind) => string
  errorKey: (code: string | undefined) => string
  sentMessage: () => string
  onClose: () => void
}

export function useInviteForm<Role>({
  invite,
  defaultRole,
  t,
  identifierErrorKey,
  errorKey,
  sentMessage,
  onClose,
}: InviteFormOptions<Role>) {
  const toast = useToast()
  const [identifierKind, setIdentifierKind] = useState<InviteIdentifierKind>("handle")
  const [identifier, setIdentifier] = useState("")
  const [role, setRole] = useState<Role>(defaultRole)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [identifierFocused, setIdentifierFocused] = useState(false)

  const onClosed = useCallback(() => {
    setIdentifierKind("handle")
    setIdentifier("")
    setRole(defaultRole)
    setErrorText(null)
    setIdentifierFocused(false)
    if (!invite.isPending) invite.reset()
  }, [defaultRole, invite])

  const value = inviteIdentifierValue(identifierKind, identifier)
  const canSubmit = value !== null && !invite.isPending

  const onPickKind = useCallback((kind: InviteIdentifierKind) => {
    setIdentifierKind(kind)
    setIdentifier("")
    setErrorText(null)
  }, [])

  const submit = useCallback(() => {
    if (invite.isPending) return
    if (value === null) {
      setErrorText(t(identifierErrorKey(identifierKind)))
      return
    }
    setErrorText(null)
    invite.mutate(
      { identifierKind, identifier: value, role },
      {
        onSuccess: () => {
          toast.show(sentMessage(), { variant: "success" })
          onClose()
        },
        onError: (err) => setErrorText(t(errorKey(appErrorCode(err)))),
      },
    )
  }, [errorKey, identifierErrorKey, identifierKind, invite, onClose, role, sentMessage, t, toast, value])

  return {
    identifierKind,
    identifier,
    setIdentifier,
    role,
    setRole,
    errorText,
    identifierFocused,
    setIdentifierFocused,
    canSubmit,
    onClosed,
    onPickKind,
    submit,
  }
}
