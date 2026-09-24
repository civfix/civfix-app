import type { ApiClient } from "@civfix/shared/client"
import type { CameraCapability, CapturedMedia } from "../../capabilities"
import { uploadMediaId } from "../../data/uploadMedia"
import { appErrorCode } from "../../data/errorCode"

type Translate = (key: string, options?: Record<string, unknown>) => string

export async function uploadAvatar(
  api: ApiClient,
  camera: CameraCapability,
  picked: CapturedMedia,
): Promise<string> {
  return uploadMediaId({ api, camera, media: picked })
}

export function avatarErrorMessage(err: unknown, t: Translate): string {
  switch (appErrorCode(err)) {
    case "MEDIA_REJECTED":
      return t("avatar.error.rejected")
    case "RATE_LIMITED":
      return t("avatar.error.rate_limited")
    default:
      return t("avatar.error.generic")
  }
}
