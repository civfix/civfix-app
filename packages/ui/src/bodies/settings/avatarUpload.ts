import type { ApiClient } from "@civfix/shared/client"
import type { CameraCapability, CapturedMedia } from "../../capabilities"
import { uploadMediaId } from "../../data/uploadMedia"
import { ErrorCode, errorCopyKey, type ErrorCodeTable } from "@civfix/shared"

type Translate = (key: string, options?: Record<string, unknown>) => string

export async function uploadAvatar(
  api: ApiClient,
  camera: CameraCapability,
  picked: CapturedMedia,
): Promise<string> {
  return uploadMediaId({ api, camera, media: picked })
}

const AVATAR_ERROR_KEYS: ErrorCodeTable<string> = {
  [ErrorCode.MEDIA_REJECTED]: "avatar.error.rejected",
  [ErrorCode.RATE_LIMITED]: "avatar.error.rate_limited",
}

export function avatarErrorMessage(err: unknown, t: Translate): string {
  return t(errorCopyKey(err, AVATAR_ERROR_KEYS, "avatar.error.generic"))
}
