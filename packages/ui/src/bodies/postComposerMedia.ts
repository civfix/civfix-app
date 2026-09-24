/**
 * Reconciling the composer's TWO media sources.
 *
 * `useComposerAttachments` owns the pick -> presign -> PUT -> finalize pipeline in COMPONENT-LOCAL state,
 * so it starts empty on every mount. The zustand draft (postComposerStore) is the surviving one — its whole
 * point is that a partially written post outlives the composer unmounting for an event/report/profile step.
 *
 * Mirroring the local hook straight into the store therefore ERASED the persisted media on every remount
 * (an empty local list overwrote a populated draft, orphaning already-finalized uploadIds). The composer
 * instead snapshots the draft's media once at mount ("carried") and appends the freshly picked items, so a
 * round-trip through another screen keeps the staged media visible, removable, and submittable.
 *
 * IDENTITY: the hook keys a pick by a process-unique `id` (the same asset can be picked twice, so the uri
 * cannot be the identity). A carried item outlived the process state that minted its id, so it is re-keyed
 * by its POSITION in the carried snapshot, `carried:<index>:<uri>` — unambiguous against the hook's `att-N`
 * ids, unique even when one asset was picked twice (the uri alone was NOT: two copies collided into one
 * React key, and removing either thumb deleted both), and enough to route a remove to the right source.
 * Carried and picked items can never collide: `carried` is snapshotted at mount and only shrinks.
 */
import type { PendingAttachment } from "../primitives/useComposerAttachments"
import type { PostComposerMedia } from "./postComposerStore"

/** How many media items one post can carry (the composer's `useComposerAttachments(...)` cap). */
export const POST_COMPOSER_MEDIA_CAP = 4

const CARRIED_ID_PREFIX = "carried:"

/** The store shape for one freshly picked attachment; "ready" only once its upload has finalized. */
export function toPostComposerMedia(item: PendingAttachment): PostComposerMedia {
  return {
    uri: item.uri,
    kind: item.kind,
    posterUri: item.posterUri ?? null,
    uploadId: item.uploadId ?? null,
    status: item.uploadId ? "ready" : "uploading",
  }
}

/** Thumb-strip shape for an item carried over from the persisted draft (see IDENTITY above). */
export function toPendingAttachment(media: PostComposerMedia, index: number): PendingAttachment {
  return {
    id: `${CARRIED_ID_PREFIX}${index}:${media.uri}`,
    uri: media.uri,
    kind: media.kind,
    posterUri: media.posterUri,
    ...(media.uploadId ? { uploadId: media.uploadId } : {}),
  }
}

/** Whether a thumb id addresses the carried draft media rather than this mount's live pick list. */
export function isCarriedMediaId(id: string): boolean {
  return id.startsWith(CARRIED_ID_PREFIX)
}

/**
 * The carried item's INDEX behind a `carried:<index>:<uri>` thumb id, or null when the id is not a
 * carried one. Removal goes by index, never by uri: two picks of the same asset share a uri, so filtering
 * on it dropped BOTH thumbs when the user removed one.
 */
export function carriedMediaIndex(id: string): number | null {
  if (!isCarriedMediaId(id)) return null
  const rest = id.slice(CARRIED_ID_PREFIX.length)
  const sep = rest.indexOf(":")
  if (sep <= 0) return null
  const index = Number(rest.slice(0, sep))
  return Number.isInteger(index) && index >= 0 ? index : null
}

/** What the composer's mount-time snapshot of the persisted draft media yields. */
export interface CarriedMediaSnapshot {
  /** The items this mount can show, submit, and remove. */
  carried: PostComposerMedia[]
  /** How many unfinishable items were dropped (drives the "add them again" notice). */
  dropped: number
}

/**
 * Snapshot the surviving draft's media for this mount, DROPPING anything whose upload never finalized.
 *
 * An item is only submittable once its `uploadId` lands. That id is written by the upload pipeline living
 * in the mount that picked it: if the composer unmounts mid-upload (an event/report/profile step), the
 * pipeline's `setAttachments` no-ops into the dead mount and the persisted entry stays
 * `{ status: "uploading", uploadId: null }` FOREVER. Nothing can resume it either — the prepared bytes and
 * mime live in that closure, not in the (deliberately JSON-only) draft. Carrying such an item forward gave
 * the user a thumbnail spinning forever, `selectPostComposerHasPendingMedia` stuck true, and a permanently
 * disabled Post button whose only escape was guessing to delete the thumb. So it is dropped here and the
 * composer says so (post-composer:media_dropped), leaving the + button as the retry.
 */
export function snapshotCarriedMedia(media: readonly PostComposerMedia[]): CarriedMediaSnapshot {
  const carried = media.filter((item) => item.uploadId != null && item.status === "ready")
  return { carried, dropped: media.length - carried.length }
}

/** Carried (persisted-draft) items first, then this mount's picks, capped. */
export function mergePostComposerMedia(
  carried: readonly PostComposerMedia[],
  picked: readonly PendingAttachment[],
  cap: number = POST_COMPOSER_MEDIA_CAP,
): PostComposerMedia[] {
  return [...carried, ...picked.map(toPostComposerMedia)].slice(0, cap)
}

/** The same merge, in the thumb-strip's shape (carried items re-keyed, live picks kept verbatim). */
export function mergePostComposerThumbs(
  carried: readonly PostComposerMedia[],
  picked: readonly PendingAttachment[],
  cap: number = POST_COMPOSER_MEDIA_CAP,
): PendingAttachment[] {
  return [...carried.map((item, index) => toPendingAttachment(item, index)), ...picked].slice(0, cap)
}

/**
 * Whether the add-media control may open the picker. The hook only counts its OWN picks against the cap,
 * so with carried draft media it would accept picks the merge above then slices off, uploading media that
 * no post ever claims.
 */
export function postComposerCanAttach(input: {
  hookCanAttach: boolean
  carried: number
  picked: number
  cap?: number
}): boolean {
  return input.hookCanAttach && input.carried + input.picked < (input.cap ?? POST_COMPOSER_MEDIA_CAP)
}
