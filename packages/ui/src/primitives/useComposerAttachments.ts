import { useCallback, useState } from "react"
import { appErrorCode } from "@civfix/contract"
import { useApi } from "../data"
import { uploadMediaId } from "../data/uploadMedia"
import { useCamera } from "../capabilities"
import type { CapturedMedia } from "../capabilities"
import { useT, type Translate } from "../i18n"
import { nextAttachmentId, uploadAttachErrorKey, type AttachErrorKey } from "./composerAttachmentId"

export interface PendingAttachment {
  id: string
  uri: string
  kind: "image" | "video"
  posterUri?: string | null
  uploadId?: string
}

export interface ComposerAttachments {
  attachments: PendingAttachment[]
  canAttach: boolean
  uploading: boolean
  allUploaded: boolean
  attachError: string | null
  onAttach: () => Promise<void>
  onCapture: () => Promise<void>
  removeAttachment: (id: string) => void
  reset: () => void
}

// The video-limits copy is shared with the report wizard, so it lives under `media`, not `attach_error`.
type AttachErrorState = { key: AttachErrorKey; params?: Record<string, number> } | { key: "video_limits" }

export function useComposerAttachments(maxAttachments = 5): ComposerAttachments {
  const { t } = useT()
  const api = useApi()
  const camera = useCamera()
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [attachError, setAttachError] = useState<AttachErrorState | null>(null)

  const canAttach = camera.isAvailable() && attachments.length < maxAttachments
  const allUploaded = attachments.every((a) => a.uploadId)

  const pickAndUpload = useCallback(
    async (source: () => Promise<CapturedMedia | null>, openError: AttachErrorKey) => {
      if (uploading) {
        setAttachError({ key: "busy" })
        return
      }
      if (!camera.isAvailable()) {
        setAttachError({ key: openError })
        return
      }
      if (attachments.length >= maxAttachments) {
        setAttachError({ key: "limit", params: { count: maxAttachments } })
        return
      }
      setAttachError(null)
      let picked: CapturedMedia | null = null
      try {
        picked = await source()
      } catch {
        setAttachError({ key: openError })
        return
      }
      if (!picked) return
      if (await camera.exceedsVideoLimits?.(picked)) {
        setAttachError({ key: "video_limits" })
        return
      }
      const local: PendingAttachment = { id: nextAttachmentId(), uri: picked.uri, kind: picked.kind, posterUri: null }
      setAttachments((prev) => [...prev, local].slice(0, maxAttachments))
      setUploading(true)
      try {
        const uploadId = await uploadMediaId({ api, camera, media: picked })
        setAttachments((prev) => prev.map((a) => (a.id === local.id ? { ...a, uploadId } : a)))
      } catch (err) {
        setAttachments((prev) => prev.filter((a) => a.id !== local.id))
        setAttachError({ key: uploadAttachErrorKey(appErrorCode(err)) })
      } finally {
        setUploading(false)
      }
    },
    [api, camera, attachments.length, maxAttachments, uploading],
  )

  const onAttach = useCallback(
    () => pickAndUpload(() => camera.pickFromLibrary(), "library"),
    [pickAndUpload, camera],
  )

  const onCapture = useCallback(
    () => pickAndUpload(() => camera.capture({ orientation: "portrait" }), "camera"),
    [pickAndUpload, camera],
  )

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const reset = useCallback(() => {
    setAttachments([])
    setAttachError(null)
  }, [])

  return {
    attachments,
    canAttach,
    uploading,
    allUploaded,
    attachError: attachErrorText(attachError, t),
    onAttach,
    onCapture,
    removeAttachment,
    reset,
  }
}

function attachErrorText(attachError: AttachErrorState | null, t: Translate): string | null {
  if (!attachError) return null
  if (attachError.key === "video_limits") return t("media.video_limits")
  const key = `attach_error.${attachError.key}`
  return attachError.params ? t(key, attachError.params) : t(key)
}
