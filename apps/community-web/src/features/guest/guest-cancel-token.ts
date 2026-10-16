import { GUEST_MANAGE_TOKEN_MAX_LENGTH, GUEST_MANAGE_TOKEN_MIN_LENGTH } from "@civfix/contract"

export function readGuestManageToken(raw: string | null | undefined): string | null {
  const token = raw?.trim() ?? ""
  if (token.length < GUEST_MANAGE_TOKEN_MIN_LENGTH) return null
  if (token.length > GUEST_MANAGE_TOKEN_MAX_LENGTH) return null
  return token
}
