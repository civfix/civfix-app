import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { sliceBetween } from "../../__tests__/sourceGuards"
import { QueryClient } from "@tanstack/react-query"
import type { NotificationDTO, NotificationPrefsDTO } from "@civfix/shared"
import { queryKeys } from "../keys"
import { notificationListFilters } from "../hooks/notifications"

const NOTIFICATIONS_PREFIX = queryKeys.notificationsRoot

function note(id: string, read: boolean): NotificationDTO {
  return {
    id,
    type: "system",
    title: `Note ${id}`,
    body: null,
    read,
    createdAt: new Date().toISOString(),
    link: null,
  }
}

const PREFS: NotificationPrefsDTO = {
  push: true,
  cleanupChat: true,
  reportUpdates: true,
  follows: true,
  mentions: true,
  postInteractions: true,
  hostBroadcasts: true,
  quietHours: null,
}

function snapshotLists(
  qc: QueryClient,
): Array<readonly [readonly unknown[], NotificationDTO[] | undefined]> {
  return qc
    .getQueriesData<NotificationDTO[]>({ queryKey: NOTIFICATIONS_PREFIX })
    .filter(([, data]) => Array.isArray(data)) as Array<
    readonly [readonly unknown[], NotificationDTO[] | undefined]
  >
}

function patchReadInFlatLists(qc: QueryClient, ids: string[]): void {
  const idSet = new Set(ids)
  qc.setQueriesData<NotificationDTO[]>({ queryKey: NOTIFICATIONS_PREFIX }, (prev) =>
    Array.isArray(prev) ? prev.map((n) => (idSet.has(n.id) ? { ...n, read: true } : n)) : prev,
  )
}

describe("mark-notifications-read cache reconciliation (slice 4)", () => {
  it("flips read across every flat list (inbox + bell preview) and leaves the prefs object untouched", () => {
    const qc = new QueryClient()
    qc.setQueryData<NotificationDTO[]>(queryKeys.notifications(50), [note("n1", false), note("n2", false)])
    qc.setQueryData<NotificationDTO[]>(queryKeys.notifications(20), [note("n1", false)])
    qc.setQueryData<NotificationPrefsDTO>(queryKeys.notificationPrefs, PREFS)

    patchReadInFlatLists(qc, ["n1"])

    const inbox = qc.getQueryData<NotificationDTO[]>(queryKeys.notifications(50))!
    expect(inbox.find((n) => n.id === "n1")).toMatchObject({ read: true })
    expect(inbox.find((n) => n.id === "n2")).toMatchObject({ read: false })
    const preview = qc.getQueryData<NotificationDTO[]>(queryKeys.notifications(20))!
    expect(preview.find((n) => n.id === "n1")).toMatchObject({ read: true })
    expect(qc.getQueryData<NotificationPrefsDTO>(queryKeys.notificationPrefs)).toEqual(PREFS)
  })

  it("rolls every patched list back to its snapshot on error", () => {
    const qc = new QueryClient()
    qc.setQueryData<NotificationDTO[]>(queryKeys.notifications(50), [note("n1", false), note("n2", false)])
    qc.setQueryData<NotificationDTO[]>(queryKeys.notifications(20), [note("n1", false)])

    const previous = snapshotLists(qc)
    patchReadInFlatLists(qc, ["n1", "n2"])
    expect(qc.getQueryData<NotificationDTO[]>(queryKeys.notifications(50))!.every((n) => n.read)).toBe(
      true,
    )

    for (const [key, data] of previous) qc.setQueryData(key as unknown[], data)
    expect(qc.getQueryData<NotificationDTO[]>(queryKeys.notifications(50))!.map((n) => n.read)).toEqual([
      false,
      false,
    ])
    const restoredPreview = qc.getQueryData<NotificationDTO[]>(queryKeys.notifications(20))!
    expect(restoredPreview.map((n) => n.read)).toEqual([false])
  })
})

describe("mark-read scope", () => {
  it("invalidates the notification lists but never the prefs entry that shares the root", async () => {
    const qc = new QueryClient()
    qc.setQueryData<NotificationDTO[]>(queryKeys.notifications(50), [note("n1", false)])
    qc.setQueryData<NotificationDTO[]>(queryKeys.notifications(20), [note("n1", false)])
    qc.setQueryData<NotificationPrefsDTO>(queryKeys.notificationPrefs, PREFS)

    await qc.invalidateQueries(notificationListFilters)

    expect(qc.getQueryState(queryKeys.notifications(50))?.isInvalidated).toBe(true)
    expect(qc.getQueryState(queryKeys.notifications(20))?.isInvalidated).toBe(true)
    expect(qc.getQueryState(queryKeys.notificationPrefs)?.isInvalidated).toBe(false)
  })
})

describe("useUpdatePrivacySettings user snapshot", () => {
  it("syncs its user ref in a layout effect, never by a write during render", () => {
    const src = readFileSync(join(__dirname, "..", "hooks", "notifications.ts"), "utf8")
    const body = sliceBetween(src, "export function useUpdatePrivacySettings", "return useMutation")
    expect(body).not.toMatch(/^ {2}userRef\.current = user$/m)
    expect(body).toMatch(/useLayoutEffect\(\(\) => \{\n\s+userRef\.current = user\n\s+\}, \[user\]\)/)
  })
})
