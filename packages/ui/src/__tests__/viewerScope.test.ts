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
import { createSubmitRunSlot } from "../report/submit"
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

interface StoreDeclaration {
  key: string
  file: string
  name: string
}

const ZUSTAND_VALUE_IMPORTS: Record<string, readonly string[]> = {
  zustand: ["create"],
  "zustand/middleware": ["persist", "createJSONStorage"],
}

/**
 * Every zustand store created anywhere in @civfix/ui source, exported or not, keyed `<path>:<binding>`.
 * Any store shape this cannot name (an unbound `create(...)`, an aliased or vanilla factory) is returned
 * as a problem, so a new store can never slip past the classification below.
 */
function zustandStores(): { stores: StoreDeclaration[]; problems: string[] } {
  const stores: StoreDeclaration[] = []
  const problems: string[] = []
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/[^\n]*/g, "$1")
    const path = relative(SRC, file)
    for (const [, clause, module] of text.matchAll(/^import\s+((?:(?!\bfrom\b)[\s\S])*?)\s+from\s+"(zustand[^"]*)"/gm)) {
      if (clause!.startsWith("type ")) continue
      const named = /^\{([^}]*)\}$/.exec(clause!)
      const allowed = ZUSTAND_VALUE_IMPORTS[module!]
      const names = named ? named[1]!.split(",").map((part) => part.trim()).filter(Boolean) : []
      if (!named || !allowed || names.some((name) => !allowed.includes(name))) {
        problems.push(`${path}: unrecognised zustand import \`${clause}\` from "${module}"`)
      }
    }
    if (!/import\s+\{[^}]*\bcreate\b[^}]*\}\s+from\s+"zustand"/.test(text)) continue
    const bound = [...text.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*create\s*[<(]/g)].map((m) => m[1]!)
    const calls = [...text.matchAll(/(?<![\w.])create\s*[<(]/g)].length
    if (calls !== bound.length) problems.push(`${path}: ${calls} create calls but ${bound.length} named stores`)
    for (const name of bound) stores.push({ key: `${path}:${name}`, file, name })
  }
  return { stores, problems }
}

/**
 * Stores that hold nothing a viewer typed, picked or was shown privately, so they are deliberately left
 * out of the viewer-scope registry. Every other zustand store must register there.
 */
const NOT_VIEWER_SCOPED: Record<string, string> = {
  "viewerScope.ts:useDraftGenerationStore": "the registry's own wipe counter",
  "nav/useNavStore.ts:useNavStore": "navigation stack and current view",
  "shell/sidebarStore.ts:useSidebarStore": "sidebar width preference",
  "shell/dockMinimizeStore.ts:useDockMinimizeStore": "dock scroll-minimize flag",
  "shell/searchBarStore.ts:useSearchBarStore": "search bar layout and focus requests",
  "shell/tabBarStore.ts:useTabBarStore": "tab bar height and last tab",
  "promo/appPromoStore.ts:useAppPromoStore": "app promo dismissal and layout heights",
  "primitives/brandAboutStore.ts:useBrandAboutStore": "About modal open flag",
  "bodies/onboardingTour.ts:useOnboardingTourStore": "host-injected tour presenter",
  "bodies/feed/feedScrollStore.ts:useFeedScrollTopStore": "scroll-to-top request counter",
  "bodies/feed/feedLiveStore.ts:useFeedLiveStore":
    "new-post ids, scoped by its own adoptViewer from the feed realtime hook",
  "bodies/linkedReportCards.ts:useLinkedReportCards":
    "public report card data, cleared when the event form closes; the linked ids live in the registered cleanup draft",
  "bodies/reportPicker/reportPickerFilterStore.ts:useReportPickerFilters": "report picker category filters",
  "bodies/host/dashboard/dashboardStore.ts:useDashboardStore":
    "dashboard org choice, re-validated against the current viewer's organizations on every render",
  "map/filterStore.ts:useReportFilterStore": "map layer toggles and public pin counts",
  "map/mapFlyToStore.ts:useMapFlyTo": "map camera requests",
  "map/mapViewportStore.ts:useMapViewport": "map viewport",
  "map/mapFocusStore.ts:useMapFocus": "focused map pin",
  "map/droppedPinStore.ts:useDroppedPin": "transient long-press pin",
  "map/locationPickStore.ts:useLocationPick": "in-progress map location pick, reset when the picker closes",
  // per-viewer, follow-up: recent searches persist across sign-out and should register with the scope.
  "bodies/searchRecentStore.ts:useSearchRecentStore": "recent searches",
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
  it("classifies every zustand store in @civfix/ui: registered with the viewer scope, or allowlisted", async () => {
    const { stores, problems } = zustandStores()
    expect(problems).toEqual([])

    const keys = stores.map(({ key }) => key)
    expect(Object.keys(NOT_VIEWER_SCOPED).filter((key) => !keys.includes(key)), "stale allowlist entries").toEqual([])

    const registered: string[] = []
    for (const { key, file, name } of stores) {
      const mod = (await import(/* @vite-ignore */ file)) as Record<string, object | undefined>
      const store = mod[name]
      const isRegistered = store !== undefined && isViewerScopedDraftStore(store)
      if (key in NOT_VIEWER_SCOPED) {
        expect(isRegistered, `${key} is registered, so drop it from the allowlist`).toBe(false)
        continue
      }
      expect(isRegistered, `${key} is neither registered with the viewer scope nor allowlisted`).toBe(true)
      registered.push(name)
    }
    expect(registered).toEqual(
      expect.arrayContaining(["useCleanupDraft", "useDraftReportStore", "usePostComposerStore", "useReplyDraftStore"]),
    )
  })

  it("scopes the in-flight report submission too: the slot registers, and a wipe drops its run", async () => {
    const slot = createSubmitRunSlot<string>()
    expect(isViewerScopedDraftStore(slot)).toBe(true)
    const body = readFileSync(join(SRC, "bodies", "ReportFlowBody.tsx"), "utf8")
    expect(body).toMatch(/const submitRuns = createSubmitRunSlot<SubmitSettled>\(/)

    adoptViewer("user-a")
    const run = slot.start(async () => "filed by A")!
    adoptViewer("user-b")
    await run
    expect(slot.unclaimed()).toBeNull()
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
