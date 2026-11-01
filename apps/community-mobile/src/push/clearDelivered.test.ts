import { test, mock } from "node:test"
import assert from "node:assert/strict"
import type { NotificationCategory } from "@civfix/contract"
import { expectConsoleWarn } from "@civfix/testing/console"
import {
  clearDelivered,
  decodeRemotePushData,
  notificationPresentation,
  reconcileDelivered,
  type DeliveredNotification,
} from "./clearDelivered.ts"

const N = (k: number) => `00000000-0000-4000-8000-00000000000${k}`

function delivered(k: number, category: NotificationCategory | null): DeliveredNotification {
  const data: Record<string, string> = {
    kind: "notification",
    notificationId: N(k),
    type: "report_update",
  }
  if (category !== null) data.category = category
  return { request: { identifier: `local-${k}`, content: { data } } }
}

function foreignIdentifier(k: number): string {
  return `expo-notifications://foreign_notifications?tag=${N(k)}&id=${k}`
}

function foreign(k: number): DeliveredNotification {
  return { request: { identifier: foreignIdentifier(k), content: { data: {} } } }
}

function deps(
  presented: DeliveredNotification[],
  list: { id: string; read: boolean }[] | Error = [],
) {
  return {
    presented: mock.fn(async () => presented),
    dismiss: mock.fn(async (_identifier: string): Promise<unknown> => undefined),
    listFirstPage: mock.fn(async () => {
      if (list instanceof Error) throw list
      return list
    }),
  }
}

function dismissed(d: ReturnType<typeof deps>): string[] {
  return d.dismiss.mock.calls.map((call) => call.arguments[0]).sort()
}

test("T16: an iOS clear is decoded from the payload's body", () => {
  const payload = {
    aps: { "content-available": 1 },
    body: { kind: "clear", ids: JSON.stringify([N(1), N(2)]) },
  }
  assert.deepEqual(decodeRemotePushData(payload, "ios"), { kind: "clear", ids: [N(1), N(2)] })
})

test("T17: Android payloads are decoded from the flat data map", () => {
  assert.deepEqual(decodeRemotePushData({ kind: "clear", all: "true" }, "android"), {
    kind: "clear",
    all: true,
  })
  const notification = {
    kind: "notification",
    notificationId: N(3),
    type: "report_update",
    category: "reportUpdates",
    link: "/reports",
  }
  assert.deepEqual(decodeRemotePushData(notification, "android"), notification)
})

test("T18: payloads that carry no valid push data decode to null", () => {
  assert.equal(decodeRemotePushData({ aps: { "content-available": 1 } }, "ios"), null)
  assert.equal(decodeRemotePushData({ kind: "clear" }, "android"), null)
  assert.equal(decodeRemotePushData({ kind: "bogus" }, "android"), null)
})

test("T19: a clear naming ids dismisses those notifications and tags, chat ones included", async () => {
  const d = deps([
    delivered(1, "reportUpdates"),
    delivered(2, "events"),
    delivered(4, "directMessages"),
    foreign(9),
    foreign(8),
  ])
  await clearDelivered({ kind: "clear", ids: [N(1), N(4), N(9)] }, d)
  assert.deepEqual(dismissed(d), ["local-1", "local-4", foreignIdentifier(9)].sort())
  assert.equal(d.listFirstPage.mock.callCount(), 0)
})

test("T20: a clear of all dismisses notifications-page categories only, leaving chat ones", async () => {
  const d = deps([
    delivered(1, "reportUpdates"),
    delivered(2, "mentions"),
    delivered(3, null),
    delivered(4, "directMessages"),
    delivered(5, "groupChats"),
    delivered(6, "reportDiscussions"),
  ])
  await clearDelivered({ kind: "clear", all: true }, d)
  assert.deepEqual(dismissed(d), ["local-1", "local-2", "local-3"])
  assert.equal(d.listFirstPage.mock.callCount(), 0)
})

test("T21: a clear of all dismisses a system-displayed notification only when the first page lists it read", async () => {
  const d = deps(
    [foreign(7), foreign(8), foreign(9)],
    [
      { id: N(7), read: true },
      { id: N(8), read: false },
    ],
  )
  await clearDelivered({ kind: "clear", all: true }, d)
  assert.equal(d.listFirstPage.mock.callCount(), 1)
  assert.deepEqual(dismissed(d), [foreignIdentifier(7)])
})

test("T22: when the first page cannot load, a clear of all still dismisses what it can tell apart", async () => {
  expectConsoleWarn("[push]")
  const d = deps(
    [delivered(1, "reportUpdates"), foreign(7)],
    new TypeError("Network request failed"),
  )
  await clearDelivered({ kind: "clear", all: true }, d)
  assert.deepEqual(dismissed(d), ["local-1"])
})

test("T23: with nothing delivered, reconcile loads nothing", async () => {
  const d = deps([])
  await reconcileDelivered(d)
  assert.equal(d.listFirstPage.mock.callCount(), 0)
  assert.equal(d.dismiss.mock.callCount(), 0)
})

test("T24: reconcile dismisses notifications-page ones read or gone from the first page, never chat ones", async () => {
  const d = deps(
    [
      delivered(1, "reportUpdates"),
      delivered(2, "events"),
      delivered(3, "mentions"),
      delivered(4, null),
      delivered(5, "directMessages"),
      delivered(6, "groupChats"),
    ],
    [
      { id: N(1), read: true },
      { id: N(2), read: false },
    ],
  )
  await reconcileDelivered(d)
  assert.deepEqual(dismissed(d), ["local-1", "local-3", "local-4"])
})

test("T25: reconcile dismisses a system-displayed notification only when the first page lists it read", async () => {
  const d = deps(
    [foreign(7), foreign(8), foreign(9)],
    [
      { id: N(7), read: true },
      { id: N(8), read: false },
    ],
  )
  await reconcileDelivered(d)
  assert.deepEqual(dismissed(d), [foreignIdentifier(7)])
})

test("T26: reconcile dismisses nothing when the first page cannot load", async () => {
  expectConsoleWarn("[push]")
  const d = deps([delivered(1, "reportUpdates")], new TypeError("Network request failed"))
  await reconcileDelivered(d)
  assert.equal(d.dismiss.mock.callCount(), 0)
})

test("T27: a clear is never shown; a notification shows a banner, a list entry and a sound, no badge", () => {
  assert.deepEqual(notificationPresentation({ kind: "clear", all: "true" }), {
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  })
  assert.deepEqual(
    notificationPresentation({ kind: "notification", notificationId: N(3), type: "report_update" }),
    {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    },
  )
})
