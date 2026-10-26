import { api } from "@/lib/api"

let request: Promise<string | null> | null = null
let known: string | null | undefined

/**
 * The backend's VAPID public key, or null when it cannot send web push. Read at runtime so one build
 * works against any backend, and once per page: a failed read is not kept, so the next call retries.
 */
export function webPushKey(): Promise<string | null> {
  request ??= api.getPushWebConfig().then(
    ({ vapidPublicKey }) => {
      known = vapidPublicKey
      return vapidPublicKey
    },
    (err: unknown) => {
      request = null
      throw err
    },
  )
  return request
}

/** The key once a read has answered, undefined before. */
export function knownWebPushKey(): string | null | undefined {
  return known
}
