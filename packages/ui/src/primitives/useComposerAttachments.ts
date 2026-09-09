import { useCallback, useState } from "react"
import { AppError } from "@civfix/shared"
import { useApi } from "../data"
import { uploadMediaId } from "../data/uploadMedia"
import { useCamera } from "../capabilities"
import type { CapturedMedia } from "../capabilities"
import { nextAttachmentId } from "./composerAttachmentId"

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

export function useComposerAttachments(maxAttachments = 5): ComposerAttachments {
  const api = useApi()
  const camera = useCamera()
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)

  const canAttach = camera.isAvailable() && attachments.length < maxAttachments
  const allUploaded = attachments.every((a) => a.uploadId)

  const pickAndUpload = useCallback(
    async (source: () => Promise<CapturedMedia | null>, openError: string) => {
      if (uploading) {
        setAttachError("Wait for the current attachment to finish uploading.")
        return
      }
      if (!camera.isAvailable()) {
        setAttachError(openError)
        return
      }
      if (attachments.length >= maxAttachments) {
        setAttachError(`You can attach up to ${maxAttachments} at a time.`)
        return
      }
      setAttachError(null)
      let picked: CapturedMedia | null = null
      try {
        picked = await source()
      } catch {
        setAttachError(openError)
        return
      }
      if (!picked) return
      const local: PendingAttachment = { id: nextAttachmentId(), uri: picked.uri, kind: picked.kind, posterUri: null }
      setAttachments((prev) => [...prev, local].slice(0, maxAttachments))
      setUploading(true)
      try {
        const uploadId = await uploadMediaId({ api, camera, media: picked })
        setAttachments((prev) => prev.map((a) => (a.id === local.id ? { ...a, uploadId } : a)))
      } catch (err) {
        setAttachments((prev) => prev.filter((a) => a.id !== local.id))
        setAttachError(err instanceof AppError ? err.message : "That attachment could not be uploaded.")
      } finally {
        setUploading(false)
      }
    },
    [api, camera, attachments.length, maxAttachments, uploading],
  )

  const onAttach = useCallback(
    () => pickAndUpload(() => camera.pickFromLibrary(), "Could not open the photo library."),
    [pickAndUpload, camera],
  )

  const onCapture = useCallback(
    () => pickAndUpload(() => camera.capture({ orientation: "portrait" }), "Could not open the camera."),
    [pickAndUpload, camera],
  )

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const reset = useCallback(() => {
    setAttachments([])
    setAttachError(null)
  }, [])

  return { attachments, canAttach, uploading, allUploaded, attachError, onAttach, onCapture, removeAttachment, reset }
}
