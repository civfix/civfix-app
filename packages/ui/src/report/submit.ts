import { AppError, ErrorCode } from "@civfix/shared"
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
import { useDraftReportStore } from "./draftStore"
import type { DraftMedia, DraftReport } from "./draftStore"

function composeDescription(draft: DraftReport): string | undefined {
  const parts: string[] = []
  const desc = draft.description.trim()
  if (desc.length > 0) parts.push(desc)

  const notes: string[] = []
  if (draft.flags.blockingSidewalk) notes.push("Blocking the sidewalk or road.")
  if (draft.flags.safetyHazard) notes.push("Reported as a safety hazard.")
  if (notes.length > 0) parts.push(notes.join(" "))

  const out = parts.join("\n\n").trim()
  return out.length > 0 ? out : undefined
}

export { putUpload, UPLOAD_PUT_BASE_TIMEOUT_MS, UPLOAD_MIN_BYTES_PER_SEC } from "../data/uploadMedia"

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

export function useReportSubmit(options?: ReportSubmitOptions): () => Promise<ReportSubmitOutcome> {
  const forComposer = options?.forComposer === true
  const api = useApi()
  const camera = useCamera()
  const hostSubmit = useSubmitReport()
  const queryClient = useQueryClient()
  const { t } = useT("report-wizard")
  const { isAuthenticated, user } = useAuthState()
  const me = useMyProfile().data?.profile ?? (user ? personFromAuthUser(user) : null)
  const createPostAsync = useCreatePost().mutateAsync

  return useCallback(async (): Promise<ReportSubmitOutcome> => {
    const store = useDraftReportStore.getState()
    const draft = store.draft

    if (!draft.category) {
      throw new AppError(ErrorCode.VALIDATION, t("errors.no_category"))
    }
    if (draft.lat == null || draft.lng == null) {
      throw new AppError(ErrorCode.VALIDATION, t("errors.no_location"))
    }
    if (draft.media.length === 0) {
      throw new AppError(ErrorCode.VALIDATION, t("errors.no_media"))
    }

    const idempotencyKey = store.ensureIdempotencyKey()

    const mediaUploadIds = await uploadAll(api, camera, draft.media)

    const description = composeDescription(draft)
    const submission: ReportSubmission = {
      idempotencyKey,
      category: draft.category as ReportCategory,
      type: (draft.reportTypeId ?? "other") as ReportType,
      lat: draft.lat,
      lng: draft.lng,
      geomSource: draft.geomSource,
      mediaUploadIds,
      ...(draft.title.trim() ? { title: draft.title.trim() } : {}),
      ...(draft.addr && draft.addr.trim() ? { addr: draft.addr.trim() } : {}),
      ...(description ? { description } : {}),
    }

    let result: ReportSubmitResult
    if (hostSubmit) {
      result = await hostSubmit(submission)
    } else {
      const body: CreateReportRequest = {
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
      const report = await api.createReport(body)
      result = {
        reportId: report.id,
        lat: report.lat,
        lng: report.lng,
        category: report.category,
        status: report.status === "held" ? "held" : "published",
      }
    }


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
        addr: submission.addr ?? null,
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

    void queryClient.invalidateQueries({ queryKey: ["mapReports"] }).catch(() => {})
    void queryClient.invalidateQueries({ queryKey: ["map", "reports"] }).catch(() => {})
    void queryClient.invalidateQueries({ queryKey: queryKeys.myReportsRoot }).catch(() => {})

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
