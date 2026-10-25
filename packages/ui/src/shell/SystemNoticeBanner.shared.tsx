import type { AppConfigResponse } from "@civfix/contract"

export function useVisibleSystemNotice(): NonNullable<AppConfigResponse["announcement"]> | null {
  throw new Error("not implemented")
}
