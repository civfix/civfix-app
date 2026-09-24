import { AppError, ErrorCode, appErrorCode, appErrorFields } from "@civfix/shared"
import type { ApiClient } from "@civfix/shared/client"
import type { CreateReportRequest, ReportCategory, ReportType } from "@civfix/shared"
import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useApi, useAuthState, useMyProfile, useSubmitReport, queryKeys } from "../data"
import { uploadMediaId } from "../data/uploadMedia"
import type { ReportSubmission, ReportSubmitResult } from "../data"
import { useCreatePost } from "../data/hooks/posts"
import { useCamera } from "../capabilities"
import type { CameraCapability } from "../capabilities"
import { useT } from "../i18n"
import {
  buildFeedShareInput,
  buildOptimisticFeedSharePost,
  classifyFeedShareFailure,
  findExistingFeedPost,
  personFromAuthUser,
  type FeedShareOutcome,
  type FeedShareReportSource,
  type FeedShareRetry,
  type FeedShareTarget,
} from "../bodies/feedShare"
import { rememberLocalReportThumb } from "../bodies/localReportThumbs"
import { registerViewerScopedDrafts } from "../viewerScope"
import { useDraftReportStore } from "./draftStore"
import type { DraftFlags, DraftMedia, DraftReport } from "./draftStore"

// Mirrors CreateReportRequestSchema's `description` max(2000); the composed text (typed description plus
// the flag notes) is what the server measures.
export const REPORT_DESCRIPTION_MAX = 2000

const DESCRIPTION_NOTE_SEPARATOR = "\n\n"

function flagNotes(flags: DraftFlags): string {
  const notes: string[] = []
  if (flags.blockingSidewalk) notes.push("Blocking the sidewalk or road.")
  if (flags.safetyHazard) notes.push("Reported as a safety hazard.")
  return notes.join(" ")
}

export function composeDescription(draft: Pick<DraftReport, "description" | "flags">): string | undefined {
  const parts: string[] = []
  const desc = draft.description.trim()
  if (desc.length > 0) parts.push(desc)

  const notes = flagNotes(draft.flags)
  if (notes.length > 0) parts.push(notes)

  const out = parts.join(DESCRIPTION_NOTE_SEPARATOR).trim()
  return out.length > 0 ? out : undefined
}

export function descriptionMaxLength(flags: DraftFlags): number {
  const notes = flagNotes(flags)
  return notes.length > 0
    ? REPORT_DESCRIPTION_MAX - DESCRIPTION_NOTE_SEPARATOR.length - notes.length
    : REPORT_DESCRIPTION_MAX
}

// The server names only the array, not the id it could not claim (expired, swept, or already bound), so
// every cached upload id is dropped and the next attempt uploads the bytes again.
export function invalidatesUploadIds(err: unknown): boolean {
  if (appErrorCode(err) !== ErrorCode.VALIDATION) return false
  const fields = appErrorFields(err)
  return fields !== undefined && Object.keys(fields).some((key) => key.split(".")[0] === "mediaUploadIds")
}

export interface SubmitRunSlot<T> {
  /** `isCurrent` turns false once the viewer who started the run is gone (sign-out or account switch). */
  start: (task: (isCurrent: () => boolean) => Promise<T>) => Promise<T> | null
  unclaimed: () => Promise<T> | null
  /** False when `run` is no longer the slot's run, so its outcome belongs to nobody on screen. */
  claim: (run: Promise<T>) => boolean
}

export interface SubmitRunSlotOptions<T> {
  /** A settled value that needs no body to show it, so no later mount may adopt it. */
  claimsItself?: (settled: T) => boolean
}

// One report submission at a time, held outside React so it outlives the body: a second tap before the
// re-render, or a remount while the first run is in flight, must not upload the media and share to the
// feed a second time. A run whose body unmounted before it settled stays unclaimed so the next mount can
// show its outcome instead of dropping it. The slot is viewer scoped: a sign-out or an account switch drops
// the run, so the next viewer's flow never shows, retries or shares the previous viewer's report.
export function createSubmitRunSlot<T>(options: SubmitRunSlotOptions<T> = {}): SubmitRunSlot<T> {
  type Entry = { run: Promise<T>; settled: boolean; claimed: boolean }
  let current: Entry | null = null
  const slot: SubmitRunSlot<T> = {
    start(task) {
      if (current && !current.settled) return null
      const isCurrent = () => current === entry
      const entry: Entry = { run: Promise.resolve().then(() => task(isCurrent)), settled: false, claimed: false }
      entry.run.then(
        (value) => {
          entry.settled = true
          if (options.claimsItself?.(value)) entry.claimed = true
        },
        () => {
          entry.settled = true
        },
      )
      current = entry
      return entry.run
    },
    unclaimed() {
      return current && !current.claimed ? current.run : null
    },
    claim(run) {
      if (current?.run !== run) return false
      current.claimed = true
      return true
    },
  }
  registerViewerScopedDrafts(slot, {
    discard: () => {
      current = null
    },
  })
  return slot
}

/** Thrown inside a submission whose viewer left mid-flight, so nothing more is sent on their behalf. */
export class SubmitRunDiscarded extends Error {
  constructor() {
    super("The viewer who started this submission is gone.")
    this.name = "SubmitRunDiscarded"
  }
}

export function submittedAddr(draft: Pick<DraftReport, "addr" | "addrEdited">): string | undefined {
  if (!draft.addrEdited) return undefined
  const line = draft.addr?.trim() ?? ""
  return line.length > 0 ? line : undefined
}

export function toCreateReportRequest(submission: ReportSubmission): CreateReportRequest {
  return {
    idempotencyKey: submission.idempotencyKey,
    category: submission.category,
    type: submission.type,
    lat: submission.lat,
    lng: submission.lng,
    geomSource: submission.geomSource,
    mediaUploadIds: submission.mediaUploadIds,
    ...(submission.title ? { title: submission.title } : {}),
    ...(submission.addr ? { addr: submission.addr } : {}),
    ...(submission.description ? { description: submission.description } : {}),
  }
}

async function uploadOne(
  api: ApiClient,
  camera: CameraCapability,
  media: DraftMedia,
): Promise<string> {
  return uploadMediaId({
    api,
    camera,
    media: {
      uri: media.uri,
      kind: media.kind,
      mime: media.mime,
      ...(media.width != null ? { width: media.width } : {}),
      ...(media.height != null ? { height: media.height } : {}),
      ...(media.durationSec != null ? { durationSec: media.durationSec } : {}),
    },
  })
}

const UPLOAD_CONCURRENCY = 3

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++
      const item = items[i]
      if (i >= items.length || item === undefined) return
      results[i] = await task(item, i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

async function uploadAll(api: ApiClient, camera: CameraCapability, media: DraftMedia[]): Promise<string[]> {
  return mapWithConcurrency(media, UPLOAD_CONCURRENCY, async (item) => {
    if (item.uploadId) return item.uploadId
    const uploadId = await uploadOne(api, camera, item)
    useDraftReportStore.getState().setMediaUploadId(item.id, uploadId)
    return uploadId
  })
}

export type ReportSubmitOutcome = ReportSubmitResult & { feedShare: FeedShareOutcome }

export interface ReportSubmitOptions {
  forComposer?: boolean
}

export function useReportSubmit(options?: ReportSubmitOptions): (isCurrent?: () => boolean) => Promise<ReportSubmitOutcome> {
  const forComposer = options?.forComposer === true
  const api = useApi()
  const camera = useCamera()
  const hostSubmit = useSubmitReport()
  const queryClient = useQueryClient()
  const { t } = useT("report-wizard")
  const { isAuthenticated, user } = useAuthState()
  const me = useMyProfile().data?.profile ?? (user ? personFromAuthUser(user) : null)
  const createPostAsync = useCreatePost().mutateAsync

  return useCallback(async (isCurrent: () => boolean = () => true): Promise<ReportSubmitOutcome> => {
    const store = useDraftReportStore.getState()
    const draft = store.draft

    if (!draft.category) {
      throw new AppError(ErrorCode.VALIDATION, t("errors.no_category"), {
        fields: { category: t("errors.no_category") },
      })
    }
    if (draft.lat == null || draft.lng == null) {
      throw new AppError(ErrorCode.VALIDATION, t("errors.no_location"), {
        fields: { lat: t("errors.no_location") },
      })
    }
    if (draft.media.length === 0) {
      throw new AppError(ErrorCode.VALIDATION, t("errors.no_media"), {
        fields: { media: t("errors.no_media") },
      })
    }

    const idempotencyKey = store.ensureIdempotencyKey()

    const mediaUploadIds = await uploadAll(api, camera, draft.media)
    if (!isCurrent()) throw new SubmitRunDiscarded()

    const description = composeDescription(draft)
    const addr = submittedAddr(draft)
    const submission: ReportSubmission = {
      idempotencyKey,
      category: draft.category as ReportCategory,
      type: (draft.reportTypeId ?? "other") as ReportType,
      lat: draft.lat,
      lng: draft.lng,
      geomSource: draft.geomSource,
      mediaUploadIds,
      ...(draft.title.trim() ? { title: draft.title.trim() } : {}),
      ...(addr ? { addr } : {}),
      ...(description ? { description } : {}),
    }

    const createReport = async (): Promise<ReportSubmitResult> => {
      if (hostSubmit) return hostSubmit(submission)
      const report = await api.createReport(toCreateReportRequest(submission))
      return {
        reportId: report.id,
        lat: report.lat,
        lng: report.lng,
        category: report.category,
        status: report.status === "held" ? "held" : "published",
      }
    }

    let result: ReportSubmitResult
    try {
      result = await createReport()
    } catch (err) {
      if (invalidatesUploadIds(err) && isCurrent()) store.clearMediaUploadIds()
      throw err
    }
    if (!isCurrent()) throw new SubmitRunDiscarded()

    let feedShare: FeedShareOutcome = { status: "skipped" }
    const shareable =
      draft.shareToFeed &&
      isAuthenticated &&
      !forComposer &&
      result.claimCode === undefined &&
      result.status !== "held"
    if (draft.feedPostId) {
      feedShare = { status: "posted", postId: draft.feedPostId }
    } else if (shareable && me) {
      const target: FeedShareTarget = { reportId: result.reportId }
      const caption = draft.feedCaption
      const input = buildFeedShareInput({ enabled: true, caption }, target)
      const reportSource: FeedShareReportSource = {
        id: result.reportId,
        category: (result.category ?? submission.category) as ReportCategory,
        type: submission.type,
        title: draft.title,
        lat: result.lat,
        lng: result.lng,
        addr: draft.addr?.trim() ?? null,
      }
      const localUri = draft.media[0]?.uri
      if (localUri) rememberLocalReportThumb(result.reportId, localUri)
      try {
        if (!input) throw new AppError(ErrorCode.VALIDATION, "Nothing to share.")
        const post = await createPostAsync({
          input,
          optimistic: buildOptimisticFeedSharePost({ author: me, caption, report: reportSource }),
        })
        store.setFeedPostId(post.id)
        feedShare = { status: "posted", postId: post.id }
      } catch (err) {
        const { reason, retryable } = classifyFeedShareFailure(err)
        feedShare = {
          status: "failed",
          reason,
          retryable,
          retry: { target, caption, report: reportSource },
        }
      }
    }

    void queryClient.invalidateQueries({ queryKey: queryKeys.mapReportsRoot })
    void queryClient.invalidateQueries({ queryKey: queryKeys.myReportsRoot })

    return { ...result, feedShare }
  }, [api, camera, createPostAsync, forComposer, hostSubmit, isAuthenticated, me, queryClient, t])
}

export function useFeedShareRetry(): (retry: FeedShareRetry) => Promise<FeedShareOutcome> {
  const api = useApi()
  const { user } = useAuthState()
  const me = useMyProfile().data?.profile ?? (user ? personFromAuthUser(user) : null)
  const createPostAsync = useCreatePost().mutateAsync

  return useCallback(
    async (retry): Promise<FeedShareOutcome> => {
      const { target, caption } = retry
      const input = me ? buildFeedShareInput({ enabled: true, caption }, target) : null
      if (!me || !input) {
        return { status: "failed", reason: "network", retryable: true, retry }
      }
      const page = await api.listUserPosts({ id: me.id }).catch(() => null)
      const existing = page ? findExistingFeedPost(page, target, me.id) : null
      if (existing) return { status: "posted", postId: existing }
      try {
        const post = await createPostAsync({
          input,
          optimistic: buildOptimisticFeedSharePost({
            author: me,
            caption,
            ...(retry.report ? { report: retry.report } : {}),
            ...(retry.event ? { event: retry.event } : {}),
          }),
        })
        return { status: "posted", postId: post.id }
      } catch (err) {
        const { reason, retryable } = classifyFeedShareFailure(err)
        return { status: "failed", reason, retryable, retry }
      }
    },
    [api, createPostAsync, me],
  )
}
