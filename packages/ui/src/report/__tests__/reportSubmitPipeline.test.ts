/**
 * Characterizes the whole `useReportSubmit` pipeline without a renderer: `useCallback` is made an identity
 * and every hook the submitter reads is replaced by a hand-built dependency, so calling the hook returns the
 * real submit function wired to fakes. The draft store is the real zustand store.
 */
import type * as TanstackQuery from "@tanstack/react-query"
import type * as React from "react"
import type { CreateReportRequest } from "@civfix/shared"
import { AppError, ErrorCode } from "@civfix/shared"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type * as Capabilities from "../../capabilities"
import type { CapturedMedia } from "../../capabilities"
import type * as Data from "../../data"
import type * as Posts from "../../data/hooks/posts"
import type { CreatePostVars } from "../../data/hooks/posts"
import type * as UploadMedia from "../../data/uploadMedia"
import type { UploadMediaInput } from "../../data/uploadMedia"
import type * as I18n from "../../i18n"

const deps = vi.hoisted(() => ({
  api: {
    createReport: vi.fn<(body: CreateReportRequest) => Promise<unknown>>(),
    listUserPosts: vi.fn(),
  },
  camera: { kind: "fake-camera" },
  hostSubmit: null as null | ((submission: unknown) => Promise<unknown>),
  auth: { isAuthenticated: true, user: null as unknown, isPending: false },
  profile: null as unknown,
  createPost: vi.fn<(vars: CreatePostVars) => Promise<unknown>>(),
  uploadMediaId: vi.fn<(input: UploadMediaInput) => Promise<string>>(),
  invalidateQueries: vi.fn<(filters: { queryKey: readonly unknown[] }) => Promise<void>>(),
  rememberLocalReportThumb: vi.fn(),
}))

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  useCallback: <T>(fn: T): T => fn,
}))

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof TanstackQuery>()),
  useQueryClient: () => ({ invalidateQueries: deps.invalidateQueries }),
}))

vi.mock("../../data", async (importOriginal) => ({
  ...(await importOriginal<typeof Data>()),
  useApi: () => deps.api,
  useAuthState: () => deps.auth,
  useMyProfile: () => ({ data: deps.profile ? { profile: deps.profile } : undefined }),
  useSubmitReport: () => deps.hostSubmit,
}))

vi.mock("../../data/uploadMedia", async (importOriginal) => ({
  ...(await importOriginal<typeof UploadMedia>()),
  uploadMediaId: deps.uploadMediaId,
}))

vi.mock("../../data/hooks/posts", async (importOriginal) => ({
  ...(await importOriginal<typeof Posts>()),
  useCreatePost: () => ({ mutateAsync: deps.createPost }),
}))

vi.mock("../../capabilities", async (importOriginal) => ({
  ...(await importOriginal<typeof Capabilities>()),
  useCamera: () => deps.camera,
}))

vi.mock("../../i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof I18n>()),
  useT: () => ({ t: (key: string) => key }),
}))

vi.mock("../../bodies/localReportThumbs", () => ({
  rememberLocalReportThumb: deps.rememberLocalReportThumb,
}))

const { useReportSubmit } = await import("../submit")
const { useDraftReportStore } = await import("../draftStore")
const { queryKeys } = await import("../../data")

const ME = {
  id: "me-1",
  name: "Maria",
  handle: "maria",
  bio: null,
  avatar: null,
  avatarUrl: null,
  followers: 0,
  following: 0,
  isFollowing: false,
}

function cap(uri: string, over: Partial<CapturedMedia> = {}): CapturedMedia {
  return { uri, kind: "image", mime: "image/jpeg", ...over }
}

function seedReadyDraft(): void {
  const s = useDraftReportStore.getState()
  s.startFromCapture(cap("file:///a.jpg", { location: { lat: 34.1, lng: -118.2, source: "exif" } }))
  s.setCategory("trash", "Dump", "dump")
}

function reportDto(over: Record<string, unknown> = {}) {
  return { id: "r-1", lat: 34.1, lng: -118.2, category: "trash", status: "published", ...over }
}

async function submitError(run: () => Promise<unknown>): Promise<AppError> {
  try {
    await run()
  } catch (err) {
    return err as AppError
  }
  throw new Error("expected the submit to reject")
}

beforeEach(() => {
  useDraftReportStore.getState().reset()
  deps.api.createReport.mockReset().mockResolvedValue(reportDto())
  deps.api.listUserPosts.mockReset()
  deps.hostSubmit = null
  deps.auth = { isAuthenticated: true, user: null, isPending: false }
  deps.profile = ME
  deps.createPost.mockReset().mockResolvedValue({ id: "post-1" })
  let n = 0
  deps.uploadMediaId.mockReset().mockImplementation(async () => `up-${++n}`)
  deps.invalidateQueries.mockReset().mockResolvedValue(undefined)
  deps.rememberLocalReportThumb.mockReset()
})

describe("useReportSubmit validation order", () => {
  it("rejects a draft with no category first, even when location and media are also missing", async () => {
    const err = await submitError(useReportSubmit())
    expect(err.code).toBe(ErrorCode.VALIDATION)
    expect(err.message).toBe("errors.no_category")
  })

  it("rejects a categorised draft with no location before looking at media", async () => {
    useDraftReportStore.getState().setCategory("trash", "Dump", "dump")
    const err = await submitError(useReportSubmit())
    expect(err.message).toBe("errors.no_location")
  })

  it("rejects a located draft with no media", async () => {
    const s = useDraftReportStore.getState()
    s.setCategory("trash", "Dump", "dump")
    s.setLocation(1, 2, "manual")
    const err = await submitError(useReportSubmit())
    expect(err.message).toBe("errors.no_media")
  })

  it("uploads nothing and mints no idempotency key when validation fails", async () => {
    useDraftReportStore.getState().setCategory("trash", "Dump", "dump")
    await submitError(useReportSubmit())
    expect(deps.uploadMediaId).not.toHaveBeenCalled()
    expect(useDraftReportStore.getState().draft.idempotencyKey).toBeNull()
  })
})

describe("useReportSubmit request composition (api branch)", () => {
  it("sends the draft's fields, the uploaded ids and the draft's idempotency key", async () => {
    seedReadyDraft()
    const key = useDraftReportStore.getState().draft.idempotencyKey
    await useReportSubmit()()
    expect(deps.api.createReport).toHaveBeenCalledTimes(1)
    expect(deps.api.createReport).toHaveBeenCalledWith({
      idempotencyKey: key,
      category: "trash",
      type: "dump",
      lat: 34.1,
      lng: -118.2,
      geomSource: "exif",
      mediaUploadIds: ["up-1"],
      title: "Dump",
    })
  })

  it("falls back to type 'other' when the draft carries no report type", async () => {
    const s = useDraftReportStore.getState()
    s.startFromCapture(cap("file:///a.jpg"))
    s.setLocation(1, 2, "device")
    s.setCategory("hazard", "")
    await useReportSubmit()()
    const body = deps.api.createReport.mock.calls[0]?.[0]
    expect(body?.type).toBe("other")
    expect(body?.geomSource).toBe("device")
    expect(body).not.toHaveProperty("title")
  })

  it("trims the title and omits a whitespace-only one", async () => {
    seedReadyDraft()
    useDraftReportStore.getState().setTitle("  Couch on the curb  ")
    await useReportSubmit()()
    expect(deps.api.createReport.mock.calls[0]?.[0].title).toBe("Couch on the curb")

    deps.api.createReport.mockClear()
    useDraftReportStore.getState().setTitle("   ")
    await useReportSubmit()()
    expect(deps.api.createReport.mock.calls[0]?.[0]).not.toHaveProperty("title")
  })

  it("sends the address only once the reporter edited it", async () => {
    seedReadyDraft()
    useDraftReportStore.getState().setPrefilledAddress("123 Main St")
    await useReportSubmit()()
    expect(deps.api.createReport.mock.calls[0]?.[0]).not.toHaveProperty("addr")

    deps.api.createReport.mockClear()
    useDraftReportStore.getState().setAddress("  Alley behind the market ")
    await useReportSubmit()()
    expect(deps.api.createReport.mock.calls[0]?.[0].addr).toBe("Alley behind the market")
  })

  it("omits the description when there is neither text nor a flag", async () => {
    seedReadyDraft()
    useDraftReportStore.getState().setDescription("   ")
    await useReportSubmit()()
    expect(deps.api.createReport.mock.calls[0]?.[0]).not.toHaveProperty("description")
  })

  it("sends the trimmed description alone when no flag is set", async () => {
    seedReadyDraft()
    useDraftReportStore.getState().setDescription("  Mattress and two chairs  ")
    await useReportSubmit()()
    expect(deps.api.createReport.mock.calls[0]?.[0].description).toBe("Mattress and two chairs")
  })

  it("appends the English flag notes after a blank line, sidewalk before hazard", async () => {
    seedReadyDraft()
    const s = useDraftReportStore.getState()
    s.setDescription("Mattress")
    s.setFlag("safetyHazard", true)
    s.setFlag("blockingSidewalk", true)
    await useReportSubmit()()
    expect(deps.api.createReport.mock.calls[0]?.[0].description).toBe(
      "Mattress\n\nBlocking the sidewalk or road. Reported as a safety hazard.",
    )
  })

  it("sends the flag notes alone when the description is empty", async () => {
    seedReadyDraft()
    useDraftReportStore.getState().setFlag("safetyHazard", true)
    await useReportSubmit()()
    expect(deps.api.createReport.mock.calls[0]?.[0].description).toBe("Reported as a safety hazard.")
  })

  it("appends the flag notes without truncating, leaving the length cap to the description input", async () => {
    seedReadyDraft()
    const s = useDraftReportStore.getState()
    s.setDescription("x".repeat(2000))
    s.setFlag("blockingSidewalk", true)
    await useReportSubmit()()
    const description = deps.api.createReport.mock.calls[0]?.[0].description ?? ""
    expect(description).toBe(`${"x".repeat(2000)}\n\nBlocking the sidewalk or road.`)
    expect(description.length).toBeGreaterThan(2000)
  })

  it("maps the created report into the result, reading any non-held status as published", async () => {
    seedReadyDraft()
    deps.api.createReport.mockResolvedValue(reportDto({ id: "r-9", status: "open", lat: 5, lng: 6 }))
    const out = await useReportSubmit()()
    expect(out).toMatchObject({ reportId: "r-9", lat: 5, lng: 6, category: "trash", status: "published" })
  })

  it("keeps a held status as held", async () => {
    seedReadyDraft()
    deps.api.createReport.mockResolvedValue(reportDto({ status: "held" }))
    const out = await useReportSubmit()()
    expect(out.status).toBe("held")
  })
})

describe("useReportSubmit host branch", () => {
  it("hands the submission to the host submitter instead of the api client", async () => {
    const hostSubmit = vi.fn(async () => ({ reportId: "r-h", lat: 1, lng: 2, status: "published" as const }))
    deps.hostSubmit = hostSubmit
    seedReadyDraft()
    const s = useDraftReportStore.getState()
    s.setDescription("Mattress")
    s.setAddress("Alley")
    const key = useDraftReportStore.getState().draft.idempotencyKey
    const out = await useReportSubmit()()
    expect(deps.api.createReport).not.toHaveBeenCalled()
    expect(hostSubmit).toHaveBeenCalledWith({
      idempotencyKey: key,
      category: "trash",
      type: "dump",
      lat: 34.1,
      lng: -118.2,
      geomSource: "exif",
      mediaUploadIds: ["up-1"],
      title: "Dump",
      addr: "Alley",
      description: "Mattress",
    })
    expect(out.reportId).toBe("r-h")
  })
})

describe("useReportSubmit uploads and retries", () => {
  it("uploads every media item in draft order and stamps each new upload id onto the draft", async () => {
    seedReadyDraft()
    const s = useDraftReportStore.getState()
    s.addCapture(cap("file:///b.mp4", { kind: "video", mime: "video/mp4", durationSec: 4 }))
    s.addCapture(cap("file:///c.jpg", { width: 10, height: 20 }))
    await useReportSubmit()()
    const uris = deps.uploadMediaId.mock.calls.map(([arg]) => arg.media.uri)
    expect(uris).toEqual(["file:///a.jpg", "file:///b.mp4", "file:///c.jpg"])
    expect(deps.api.createReport.mock.calls[0]?.[0].mediaUploadIds).toEqual(["up-1", "up-2", "up-3"])
    expect(useDraftReportStore.getState().draft.media.map((m) => m.uploadId)).toEqual([
      "up-1",
      "up-2",
      "up-3",
    ])
  })

  it("passes the api, the camera and only the defined media dimensions to the uploader", async () => {
    seedReadyDraft()
    useDraftReportStore.getState().addCapture(cap("file:///c.jpg", { width: 10, height: 20 }))
    await useReportSubmit()()
    const [first, second] = deps.uploadMediaId.mock.calls.map(([arg]) => arg)
    expect(first?.api).toBe(deps.api)
    expect(first?.camera).toBe(deps.camera)
    expect(first?.media).toEqual({ uri: "file:///a.jpg", kind: "image", mime: "image/jpeg" })
    expect(second?.media).toEqual({
      uri: "file:///c.jpg",
      kind: "image",
      mime: "image/jpeg",
      width: 10,
      height: 20,
    })
  })

  it("never runs more than three uploads at once", async () => {
    seedReadyDraft()
    const s = useDraftReportStore.getState()
    for (const uri of ["b", "c", "d", "e"]) s.addCapture(cap(`file:///${uri}.jpg`))
    let inFlight = 0
    let peak = 0
    deps.uploadMediaId.mockImplementation(async ({ media }: { media: { uri: string } }) => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight -= 1
      return `up:${media.uri}`
    })
    await useReportSubmit()()
    expect(peak).toBe(3)
    expect(deps.api.createReport.mock.calls[0]?.[0].mediaUploadIds).toEqual([
      "up:file:///a.jpg",
      "up:file:///b.jpg",
      "up:file:///c.jpg",
      "up:file:///d.jpg",
      "up:file:///e.jpg",
    ])
  })

  it("propagates an upload failure without creating the report, keeping the uploads that finished", async () => {
    seedReadyDraft()
    useDraftReportStore.getState().addCapture(cap("file:///b.jpg"))
    deps.uploadMediaId.mockImplementation(async ({ media }: { media: { uri: string } }) => {
      if (media.uri === "file:///b.jpg") throw new AppError(ErrorCode.MEDIA_REJECTED, "nope")
      return "up-a"
    })
    const err = await submitError(useReportSubmit())
    expect(err.code).toBe(ErrorCode.MEDIA_REJECTED)
    expect(deps.api.createReport).not.toHaveBeenCalled()
    expect(useDraftReportStore.getState().draft.media.map((m) => m.uploadId)).toEqual(["up-a", undefined])
  })

  it("reuses the idempotency key and the cached upload ids on a retry after a failed create", async () => {
    seedReadyDraft()
    deps.api.createReport.mockRejectedValueOnce(new AppError(ErrorCode.INTERNAL, "boom"))
    const submit = useReportSubmit()
    await submitError(submit)
    await submit()
    expect(deps.uploadMediaId).toHaveBeenCalledTimes(1)
    const [firstBody, secondBody] = deps.api.createReport.mock.calls.map(([body]) => body)
    expect(secondBody?.idempotencyKey).toBe(firstBody?.idempotencyKey)
    expect(secondBody?.mediaUploadIds).toEqual(["up-1"])
    expect(firstBody?.mediaUploadIds).toEqual(["up-1"])
  })

  it("mints an idempotency key for a draft that has none and keeps it on the draft", async () => {
    const s = useDraftReportStore.getState()
    s.setCategory("trash", "Dump", "dump")
    s.setLocation(1, 2, "manual")
    s.setMedia({ uri: "file:///a.jpg", kind: "image", mime: "image/jpeg" })
    expect(useDraftReportStore.getState().draft.idempotencyKey).toBeNull()
    await useReportSubmit()()
    const key = useDraftReportStore.getState().draft.idempotencyKey
    expect(key).toBeTruthy()
    expect(deps.api.createReport.mock.calls[0]?.[0].idempotencyKey).toBe(key)
  })
})

describe("useReportSubmit cache invalidation", () => {
  it("invalidates the map-reports prefix and my-reports after a submit", async () => {
    seedReadyDraft()
    await useReportSubmit()()
    expect(deps.invalidateQueries.mock.calls.map(([arg]) => arg)).toEqual([
      { queryKey: queryKeys.mapReportsRoot },
      { queryKey: queryKeys.myReportsRoot },
    ])
  })

  it("swallows an invalidation rejection", async () => {
    seedReadyDraft()
    deps.invalidateQueries.mockRejectedValue(new Error("gone"))
    await expect(useReportSubmit()()).resolves.toMatchObject({ reportId: "r-1" })
  })
})

describe("useReportSubmit feed share", () => {
  function enableShare(caption = "Look at this"): void {
    const s = useDraftReportStore.getState()
    s.setShareToFeed(true)
    s.setFeedCaption(caption)
  }

  it("skips the share when the reporter left it off", async () => {
    seedReadyDraft()
    const out = await useReportSubmit()()
    expect(out.feedShare).toEqual({ status: "skipped" })
    expect(deps.createPost).not.toHaveBeenCalled()
  })

  it("posts a report share with the trimmed caption and records the post id on the draft", async () => {
    seedReadyDraft()
    enableShare("  Look at this  ")
    const out = await useReportSubmit()()
    expect(out.feedShare).toEqual({ status: "posted", postId: "post-1" })
    expect(useDraftReportStore.getState().draft.feedPostId).toBe("post-1")
    const vars = deps.createPost.mock.calls[0]?.[0]
    expect(vars?.input).toEqual({
      kind: "post",
      body: "Look at this",
      reportId: "r-1",
      mediaUploadIds: [],
      mentionedUserIds: [],
    })
    expect(vars?.optimistic.author.id).toBe("me-1")
    expect(deps.rememberLocalReportThumb).toHaveBeenCalledWith("r-1", "file:///a.jpg")
  })

  it("skips the share for a guest", async () => {
    seedReadyDraft()
    enableShare()
    deps.auth = { isAuthenticated: false, user: null, isPending: false }
    const out = await useReportSubmit()()
    expect(out.feedShare).toEqual({ status: "skipped" })
  })

  it("skips the share from the post composer", async () => {
    seedReadyDraft()
    enableShare()
    const out = await useReportSubmit({ forComposer: true })()
    expect(out.feedShare).toEqual({ status: "skipped" })
    expect(deps.createPost).not.toHaveBeenCalled()
  })

  it("skips the share for a held report", async () => {
    seedReadyDraft()
    enableShare()
    deps.api.createReport.mockResolvedValue(reportDto({ status: "held" }))
    const out = await useReportSubmit()()
    expect(out.feedShare).toEqual({ status: "skipped" })
  })

  it("skips the share for a claim-code (guest SMS) result", async () => {
    seedReadyDraft()
    enableShare()
    deps.hostSubmit = async () => ({ reportId: "r-c", lat: 1, lng: 2, claimCode: "ABC123" })
    const out = await useReportSubmit()()
    expect(out.feedShare).toEqual({ status: "skipped" })
  })

  it("skips the share when no author can be resolved", async () => {
    seedReadyDraft()
    enableShare()
    deps.profile = null
    const out = await useReportSubmit()()
    expect(out.feedShare).toEqual({ status: "skipped" })
    expect(deps.createPost).not.toHaveBeenCalled()
  })

  it("falls back to the auth user as the author when the profile is not loaded", async () => {
    seedReadyDraft()
    enableShare()
    deps.profile = null
    deps.auth = {
      isAuthenticated: true,
      user: { id: "u-2", displayName: "Theo", handle: "theo", avatarUrl: null },
      isPending: false,
    }
    await useReportSubmit()()
    expect(deps.createPost.mock.calls[0]?.[0].optimistic.author.id).toBe("u-2")
  })

  it("reports an already-shared draft as posted without posting again", async () => {
    seedReadyDraft()
    enableShare()
    useDraftReportStore.getState().setFeedPostId("post-earlier")
    const out = await useReportSubmit()()
    expect(out.feedShare).toEqual({ status: "posted", postId: "post-earlier" })
    expect(deps.createPost).not.toHaveBeenCalled()
  })

  it("returns a retryable failure carrying the retry payload when the post fails", async () => {
    seedReadyDraft()
    enableShare("Caption")
    deps.createPost.mockRejectedValue(new AppError(ErrorCode.RATE_LIMITED, "slow down"))
    const out = await useReportSubmit()()
    expect(out.reportId).toBe("r-1")
    expect(out.feedShare).toMatchObject({
      status: "failed",
      reason: "rate-limited",
      retryable: true,
      retry: {
        target: { reportId: "r-1" },
        caption: "Caption",
        report: { id: "r-1", category: "trash", type: "dump", title: "Dump", lat: 34.1, lng: -118.2, addr: null },
      },
    })
    expect(useDraftReportStore.getState().draft.feedPostId).toBeNull()
  })

  it("marks a validation rejection of the share as not retryable", async () => {
    seedReadyDraft()
    enableShare()
    deps.createPost.mockRejectedValue(new AppError(ErrorCode.VALIDATION, "bad"))
    const out = await useReportSubmit()()
    expect(out.feedShare).toMatchObject({ status: "failed", reason: "rejected", retryable: false })
  })
})
