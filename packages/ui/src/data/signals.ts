import type { SignalTopic } from "@civfix/shared"

import { queryKeys } from "./keys"

const HOST_ROOT = ["host"] as const

export function invalidationKeysForTopic(
  topic: SignalTopic,
  extra?: Partial<Record<SignalTopic, ReadonlyArray<readonly unknown[]>>>,
  id?: string | null,
): ReadonlyArray<readonly unknown[]> {
  const base = baseKeysForTopic(topic, id ?? null)
  const additional = extra?.[topic]
  return additional && additional.length > 0 ? [...base, ...additional] : base
}

function baseKeysForTopic(topic: SignalTopic, id: string | null): ReadonlyArray<readonly unknown[]> {
  switch (topic) {
    case "notifications":
      return [queryKeys.notificationsRoot]
    case "threads":
      return [queryKeys.threads]
    case "reports":
      return [queryKeys.myReportsRoot]
    case "host":
      return [id ? queryKeys.hostEvent(id) : HOST_ROOT]
    default:
      return []
  }
}
