export const SESSION_REVOKE_TIMEOUT_MS = 3000

export interface SessionRevokeDeps {
  readBearer: () => Promise<string | null>
  revoke: (bearer: string, signal: AbortSignal) => Promise<unknown>
}

export async function revokeServerSession(deps: SessionRevokeDeps): Promise<boolean> {
  let bearer: string | null = null
  try {
    bearer = await deps.readBearer()
  } catch {
    return false
  }
  if (!bearer) return false

  const controller = new AbortController()
  const abort = setTimeout(() => controller.abort(), SESSION_REVOKE_TIMEOUT_MS)
  try {
    await deps.revoke(bearer, controller.signal)
    return true
  } catch {
    return false
  } finally {
    clearTimeout(abort)
  }
}
