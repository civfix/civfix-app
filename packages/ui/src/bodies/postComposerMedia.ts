/**
 * Reconciles the composer's two media sources. `useComposerAttachments` keeps picks in component state
 * that starts empty on every mount, while the zustand draft survives the composer unmounting, so the
 * composer snapshots the draft's media at mount ("carried") and appends fresh picks instead of mirroring
 * the hook into the store, which would erase finalized uploads. A carried item is keyed by its position,
 * `carried:<index>:<uri>`, because its process-unique id is gone and the uri alone collides when one asset
 * is picked twice; `carried` only shrinks after mount, so it cannot collide with the hook's `att-N` ids.
 */
import type { PendingAttachment } from "../primitives/useComposerAttachments"
import type { PostComposerMedia } from "./postComposerStore"

export const POST_COMPOSER_MEDIA_CAP = 4

const CARRIED_ID_PREFIX = "carried:"

export function toPostComposerMedia(item: PendingAttachment): PostComposerMedia {
  return {
    uri: item.uri,
    kind: item.kind,
    posterUri: item.posterUri ?? null,
    uploadId: item.uploadId ?? null,
    status: item.uploadId ? "ready" : "uploading",
  }
}

function toPendingAttachment(media: PostComposerMedia, index: number): PendingAttachment {
  return {
    id: `${CARRIED_ID_PREFIX}${index}:${media.uri}`,
    uri: media.uri,
    kind: media.kind,
    posterUri: media.posterUri,
    ...(media.uploadId ? { uploadId: media.uploadId } : {}),
  }
}

export function isCarriedMediaId(id: string): boolean {
  return id.startsWith(CARRIED_ID_PREFIX)
}

/** Removal goes by index, never by uri: two picks of the same asset share a uri. */
export function carriedMediaIndex(id: string): number | null {
  if (!isCarriedMediaId(id)) return null
  const rest = id.slice(CARRIED_ID_PREFIX.length)
  const sep = rest.indexOf(":")
  if (sep <= 0) return null
  const index = Number(rest.slice(0, sep))
  return Number.isInteger(index) && index >= 0 ? index : null
}

export interface CarriedMediaSnapshot {
  carried: PostComposerMedia[]
  dropped: number
}

/**
 * Drops items whose upload never finalized: the pipeline that would set their `uploadId` died with the
 * mount that picked them, and the bytes are not in the JSON-only draft, so they could never finish and would
 * hold the Post button disabled. The composer tells the user so they can add them again.
 */
export function snapshotCarriedMedia(media: readonly PostComposerMedia[]): CarriedMediaSnapshot {
  const carried = media.filter((item) => item.uploadId != null && item.status === "ready")
  return { carried, dropped: media.length - carried.length }
}

export function mergePostComposerMedia(
  carried: readonly PostComposerMedia[],
  picked: readonly PendingAttachment[],
  cap: number = POST_COMPOSER_MEDIA_CAP,
): PostComposerMedia[] {
  return [...carried, ...picked.map(toPostComposerMedia)].slice(0, cap)
}

export function mergePostComposerThumbs(
  carried: readonly PostComposerMedia[],
  picked: readonly PendingAttachment[],
  cap: number = POST_COMPOSER_MEDIA_CAP,
): PendingAttachment[] {
  return [...carried.map((item, index) => toPendingAttachment(item, index)), ...picked].slice(0, cap)
}

/**
 * The hook only counts its own picks against the cap, so with carried media it would accept picks the
 * merge then slices off, uploading media no post ever claims.
 */
export function postComposerCanAttach(input: {
  hookCanAttach: boolean
  carried: number
  picked: number
  cap?: number
}): boolean {
  return input.hookCanAttach && input.carried + input.picked < (input.cap ?? POST_COMPOSER_MEDIA_CAP)
}
