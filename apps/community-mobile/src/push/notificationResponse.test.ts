import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { expectConsoleWarn } from "@civfix/testing/console"
import type { AuthStatus } from "../lib/lifecycleTypes.ts"
import { openNotificationResponse, type TappedNotification } from "./notificationResponse.ts"

const N3 = "00000000-0000-4000-8000-000000000003"

function tapped(data: Record<string, string>, identifier = "push-1"): TappedNotification {
  return { notification: { request: { identifier, content: { data } } } }
}

const REPORT_PUSH = {
  kind: "notification",
  notificationId: N3,
  type: "report_update",
  category: "reportUpdates",
  link: "/reports",
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve))
}

function deps(
  initial: AuthStatus,
  markRead: (ids: string[]) => Promise<unknown> = async () => ({}),
) {
  let status = initial
  const listeners = new Set<(next: AuthStatus) => void>()
  return {
    setStatus(next: AuthStatus) {
      status = next
      for (const listener of [...listeners]) listener(next)
    },
    authStatus: () => status,
    onAuthStatus: (listener: (next: AuthStatus) => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    markRead: mock.fn(markRead),
    open: mock.fn((_link: string): void => {}),
    handled: new Set<string>(),
  }
}

test("T28: a tapped push marks its notification read and opens its link", async () => {
  const d = deps("authed")
  await openNotificationResponse(tapped(REPORT_PUSH), d)
  assert.equal(d.markRead.mock.callCount(), 1)
  assert.deepEqual(d.markRead.mock.calls[0]?.arguments, [[N3]])
  assert.equal(d.open.mock.callCount(), 1)
  assert.deepEqual(d.open.mock.calls[0]?.arguments, ["/reports"])
})

test("T29: on a cold start the link opens at once and the read waits for the session", async () => {
  const d = deps("loading")
  const done = openNotificationResponse(tapped(REPORT_PUSH), d)
  await settle()
  assert.deepEqual(d.open.mock.calls[0]?.arguments, ["/reports"])
  assert.equal(d.markRead.mock.callCount(), 0)
  d.setStatus("authed")
  await done
  assert.deepEqual(d.markRead.mock.calls[0]?.arguments, [[N3]])

  const guest = deps("loading")
  const guestDone = openNotificationResponse(tapped(REPORT_PUSH), guest)
  await settle()
  guest.setStatus("unauthed")
  await guestDone
  assert.equal(guest.markRead.mock.callCount(), 0)
  assert.deepEqual(guest.open.mock.calls[0]?.arguments, ["/reports"])
})

test("T30: a read that fails still opens the link and does not throw", async () => {
  expectConsoleWarn("[push]")
  const d = deps("authed", async () => {
    throw new TypeError("Network request failed")
  })
  await openNotificationResponse(tapped(REPORT_PUSH), d)
  assert.deepEqual(d.open.mock.calls[0]?.arguments, ["/reports"])
})

test("T31: the same response handled twice marks read and opens once", async () => {
  const d = deps("authed")
  await openNotificationResponse(tapped(REPORT_PUSH), d)
  await openNotificationResponse(tapped(REPORT_PUSH), d)
  assert.equal(d.markRead.mock.callCount(), 1)
  assert.equal(d.open.mock.callCount(), 1)
})

test("T32: a push without a link is marked read and opens nothing", async () => {
  const d = deps("authed")
  await openNotificationResponse(
    tapped({ kind: "notification", notificationId: N3, type: "system" }),
    d,
  )
  assert.deepEqual(d.markRead.mock.calls[0]?.arguments, [[N3]])
  assert.equal(d.open.mock.callCount(), 0)
})
