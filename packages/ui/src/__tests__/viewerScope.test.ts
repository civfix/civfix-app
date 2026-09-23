import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { beforeEach, describe, expect, it } from "vitest"
import type { PostComposerMedia } from "../bodies/postComposerStore"
import type { CleanupFormValue } from "../bodies/CleanupForm"
import { selectPostComposerDraft, usePostComposerStore } from "../bodies/postComposerStore"
import { useReplyDraftStore } from "../bodies/thread/replyDraftStore"
import { useCleanupDraft } from "../bodies/cleanupDraftStore"
import { useDraftReportStore } from "../report/draftStore"
import {
  adoptViewer,
  discardViewerDrafts,
  isViewerScopedDraftStore,
  registerViewerScopedDrafts,
  viewerDraftGeneration,
} from "../viewerScope"

const SRC = fileURLToPath(new URL("..", import.meta.url))

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

/** Every zustand store whose module or name says it holds a draft (what a viewer typed or picked). */
function draftStoreDeclarations(): { file: string; name: string }[] {
  return sourceFiles(SRC).flatMap((file) => {
    const text = readFileSync(file, "utf8")
    return [...text.matchAll(/export const (use\w+) = create</g)]
      .map((match) => ({ file, name: match[1]! }))
      .filter(({ file: path, name }) => /draft|composer/i.test(name) || /draft|composer/i.test(path))
  })
}

const readyMedia: PostComposerMedia = {
  uri: "file:///a.jpg",
  kind: "image",
  posterUri: null,
  uploadId: "upload-a",
  status: "ready",
}

function cleanupForm(): CleanupFormValue {
  return {
    organizationId: null,
    title: "River cleanup",
    description: "Meet by the bridge",
    eventKind: "cleanup",
    addrQuery: "",
    spot: "",
    address: "",
    addressSource: null,
    addressPointKey: null,
    coords: { lat: 34.05, lng: -118.24 },
    date: null,
    time: null,
    endTime: null,
    timezone: "America/Los_Angeles",
    bring: [],
    slots: [],
    linkedReportIds: ["report-1"],
    shareToFeed: true,
    feedCaption: "",
    coverMediaId: "media-cover",
    coverPreviewUrl: null,
  }
}

function writeEveryDraft(): void {
  usePostComposerStore.getState().setBody("post draft")
  useReplyDraftStore.getState().setBody("post-1", "reply draft")
  useReplyDraftStore.getState().setMedia("post-1", [readyMedia])
  const report = useDraftReportStore.getState()
  report.startFromCapture({ uri: "file:///photo.jpg", kind: "image", mime: "image/jpeg" })
  report.setLocation(34.0522, -118.2437, "device")
  report.setDescription("Needle on the path by my house")
  report.setMediaUploadId(useDraftReportStore.getState().draft.media[0]!.id, "upload-report")
  useCleanupDraft.getState().begin(cleanupForm())
}

function expectEveryDraftWiped(): void {
  expect(selectPostComposerDraft(usePostComposerStore.getState()).body).toBe("")
  expect(useReplyDraftStore.getState().drafts).toEqual({})
  const report = useDraftReportStore.getState().draft
  expect(report).toMatchObject({ description: "", lat: null, lng: null, media: [] })
  expect(useCleanupDraft.getState()).toMatchObject({ active: false, value: null })
}

function expectEveryDraftKept(): void {
  expect(selectPostComposerDraft(usePostComposerStore.getState()).body).toBe("post draft")
  expect(useReplyDraftStore.getState().drafts["post-1"]?.body).toBe("reply draft")
  expect(useReplyDraftStore.getState().drafts["post-1"]?.media.map((m) => m.uploadId)).toEqual(["upload-a"])
  const report = useDraftReportStore.getState().draft
  expect(report.description).toBe("Needle on the path by my house")
  expect(report.lat).toBe(34.0522)
  expect(report.media.map((m) => m.uploadId)).toEqual(["upload-report"])
  expect(useCleanupDraft.getState().value?.title).toBe("River cleanup")
}

beforeEach(() => {
  adoptViewer(null)
  discardViewerDrafts()
})

describe("viewer-scoped drafts registry", () => {
  it("registers every draft store in @civfix/ui, so none can outlive its account", async () => {
    const declared = draftStoreDeclarations()
    expect(declared.map(({ name }) => name).sort()).toEqual(
      expect.arrayContaining(["useCleanupDraft", "useDraftReportStore", "usePostComposerStore", "useReplyDraftStore"]),
    )
    for (const { file, name } of declared) {
      const mod = (await import(/* @vite-ignore */ file)) as Record<string, object>
      expect(isViewerScopedDraftStore(mod[name]!), `${relative(SRC, file)}: ${name} is not registered`).toBe(true)
    }
  })

  it("a confirmed sign-out wipes every draft: text, precise location, photos and upload ids", () => {
    adoptViewer("user-a")
    writeEveryDraft()

    discardViewerDrafts()
    adoptViewer(null)

    expectEveryDraftWiped()
  })

  it("a different account wipes what the previous account wrote", () => {
    adoptViewer("user-a")
    writeEveryDraft()

    adoptViewer("user-b")

    expectEveryDraftWiped()
  })

  it("a transient loss of the viewer keeps every draft for the same account", () => {
    adoptViewer("user-a")
    writeEveryDraft()

    adoptViewer(null)
    adoptViewer("user-a")

    expectEveryDraftKept()
  })

  it("a transient loss followed by a different account still wipes", () => {
    adoptViewer("user-a")
    writeEveryDraft()

    adoptViewer(null)
    adoptViewer("user-b")

    expectEveryDraftWiped()
  })

  it("a guest who signs in keeps the report they started signed out", () => {
    const report = useDraftReportStore.getState()
    report.startFromCapture({ uri: "file:///guest.jpg", kind: "image", mime: "image/jpeg" })
    report.setLocation(34.0522, -118.2437, "manual")
    report.setDescription("Started as a guest")

    adoptViewer("user-a")

    expect(useDraftReportStore.getState().draft).toMatchObject({ description: "Started as a guest", lat: 34.0522 })
  })

  it("a guest report survives a later sign-in after a confirmed sign-out", () => {
    adoptViewer("user-a")
    discardViewerDrafts()
    adoptViewer(null)
    useDraftReportStore.getState().setDescription("Typed by the next guest")

    adoptViewer("user-b")

    expect(useDraftReportStore.getState().draft.description).toBe("Typed by the next guest")
  })

  it("bumps the draft generation on a wipe only, so mounted composers drop their local copies", () => {
    adoptViewer("user-a")
    const before = viewerDraftGeneration()
    adoptViewer(null)
    adoptViewer("user-a")
    expect(viewerDraftGeneration()).toBe(before)

    adoptViewer("user-b")
    expect(viewerDraftGeneration()).toBe(before + 1)
    discardViewerDrafts()
    expect(viewerDraftGeneration()).toBe(before + 2)
  })

  it("tells a store that registers late who the viewer is", () => {
    adoptViewer("user-a")
    const seen: (string | null)[] = []
    const store = {}
    registerViewerScopedDrafts(store, { discard: () => undefined, onViewer: (id) => seen.push(id) })
    adoptViewer(null)
    expect(seen).toEqual(["user-a", null])
  })
})
