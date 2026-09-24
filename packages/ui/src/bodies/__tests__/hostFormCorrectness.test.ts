import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it } from "vitest"
import { useCleanupDraft } from "../cleanupDraftStore"
import { emptyCleanupForm, type CleanupFormValue } from "../cleanupFormModel"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const form = strip(read("../CleanupForm.tsx"))
const create = strip(read("../CreateCleanupBody.tsx"))
const edit = strip(read("../EditCleanupBody.tsx"))

function mkForm(overrides: Partial<CleanupFormValue> = {}): CleanupFormValue {
  return { ...emptyCleanupForm(), timezone: "America/Los_Angeles", slots: [], ...overrides }
}

beforeEach(() => useCleanupDraft.getState().clear())

describe("a cover upload lands on the draft as it is when the upload finishes", () => {
  it("keeps what the host typed while the upload was in flight", () => {
    const store = useCleanupDraft.getState()
    store.begin(mkForm())
    useCleanupDraft.getState().patch(mkForm({ title: "Beach day", description: "Bring gloves" }))
    useCleanupDraft.getState().merge({ coverMediaId: "m1", coverPreviewUrl: "file:///cover.jpg" })
    expect(useCleanupDraft.getState().value).toMatchObject({
      title: "Beach day",
      description: "Bring gloves",
      coverMediaId: "m1",
      coverPreviewUrl: "file:///cover.jpg",
    })
  })

  it("does not bring back a draft the host already left", () => {
    useCleanupDraft.getState().begin(mkForm())
    useCleanupDraft.getState().clear()
    useCleanupDraft.getState().merge({ coverMediaId: "m1" })
    expect(useCleanupDraft.getState().value).toBeNull()
    expect(useCleanupDraft.getState().active).toBe(false)
  })

  it("commits the cover through the merge path on both hosts, never the render-time spread", () => {
    expect(form).toContain("onPatch({ coverMediaId: uploaded.mediaId, coverPreviewUrl: picked.uri })")
    expect(form).not.toContain("patch({ coverMediaId: uploaded.mediaId")
    expect(create).toContain("useCleanupDraft.getState().merge(partial)")
    expect(create.match(/onPatch=\{mergeIntoDraft\}/g) ?? []).toHaveLength(2)
    expect(edit).toContain("setForm((prev) => ({ ...prev, ...partial }))")
    expect(edit).toContain("onPatch={mergeForm}")
  })
})

describe("publishing a new event is idempotent per draft", () => {
  it("mints a key when a draft begins and keeps it across edits and a resumed begin", () => {
    useCleanupDraft.getState().begin(mkForm())
    const key = useCleanupDraft.getState().idempotencyKey
    expect(key).toMatch(/^[0-9a-f-]{36}$/)
    useCleanupDraft.getState().patch(mkForm({ title: "Retry me" }))
    useCleanupDraft.getState().merge({ coverMediaId: "m1" })
    useCleanupDraft.getState().begin(mkForm())
    expect(useCleanupDraft.getState().idempotencyKey).toBe(key)
  })

  it("drops the key with the draft, so the next event never reuses the last one's", () => {
    useCleanupDraft.getState().begin(mkForm())
    const first = useCleanupDraft.getState().idempotencyKey
    useCleanupDraft.getState().clear()
    expect(useCleanupDraft.getState().idempotencyKey).toBeNull()
    useCleanupDraft.getState().begin(mkForm())
    const second = useCleanupDraft.getState().idempotencyKey
    expect(second).not.toBeNull()
    expect(second).not.toBe(first)
  })

  it("sends the draft's key and refuses a second publish while one is in flight", () => {
    expect(create).toContain("const { idempotencyKey } = useCleanupDraft.getState()")
    expect(create).toContain("...(idempotencyKey ? { idempotencyKey } : {})")
    expect(create).toMatch(/if \(publishing\.current\) return[\s\S]*?publishing\.current = true\s*create\.mutate\(/)
    expect(create).toMatch(/onSettled: \(\) => \{\s*publishing\.current = false\s*\}/)
  })
})

describe("the host form's mount step", () => {
  it("never overwrites a resumed draft wholesale with the planned value", () => {
    expect(create).not.toContain("patch(mountPlan.value)")
    expect(create).not.toContain("withSeededSlot")
  })

  it("centers the map picker on the shared, time-capped user location", () => {
    expect(create).toContain("const userLocation = useUserLocation()")
    expect(create).toContain(
      "(seedPoint ? { lat: seedPoint.lat, lng: seedPoint.lng } : (userLocation.data ?? null))",
    )
    expect(create).toContain("[seedPoint, userLocation.data]")
    expect(create).not.toContain("setInitialCenter")
  })
})

describe("the edit route waits for the session before judging the viewer", () => {
  const body = edit.slice(edit.indexOf("export function EditCleanupBody"))

  it("shows the skeleton while auth is pending and a sign-in prompt when signed out", () => {
    expect(body).toContain("const { user, isAuthenticated, isPending } = useAuthState()")
    expect(body).toContain("if (isPending || query.isLoading) return <EventFormSkeleton />")
    expect(body).toContain('next: pathForEntry({ kind: "edit-cleanup", id })')
    const signIn = body.indexOf("if (!isAuthenticated)")
    const denied = body.indexOf('t("denied.title")')
    expect(signIn).toBeGreaterThan(-1)
    expect(signIn).toBeLessThan(denied)
  })
})

describe("the edit form's linked-report cards", () => {
  it("re-puts the cards whenever the event's refs change, not only when the id list does", () => {
    expect(edit).toMatch(/put\(linkedReports\.map\(linkedRefToCardData\)\)\s*\}, \[linkedReports\]\)/)
    expect(edit).not.toContain("}, [linkedReportIds])")
  })

  it("leaves the cache alone on unmount while a create draft still shows its cards", () => {
    expect(edit).toContain(
      "if (!useCleanupDraft.getState().active) useLinkedReportCards.getState().clear()",
    )
  })
})
