import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { expectConsoleWarn } from "@civfix/testing/console"
import { clearDelivered, reconcileDelivered, type DeliveredNotification } from "./clearDelivered.ts"

const N1 = "00000000-0000-4000-8000-000000000001"
const N2 = "00000000-0000-4000-8000-000000000002"

function pushed(id: string, identifier: string): DeliveredNotification {
  return {
    request: {
      identifier,
      content: { data: { kind: "notification", notificationId: id, type: "report_update" } },
    },
  }
}

function other(identifier: string, data: unknown = {}): DeliveredNotification {
  return { request: { identifier, content: { data } } }
}

test("notifications that are neither civfix pushes nor tagged system ones are never touched", async () => {
  const dismiss = mock.fn(async (_identifier: string) => undefined)
  const presented = [
    other("local-reminder", { link: "/reports" }),
    other("expo-notifications://foreign_notifications?id=3"),
    other("expo-notifications://foreign_notifications?tag=%E0%A4%A&id=4"),
  ]
  await clearDelivered(
    { kind: "clear", all: true },
    { presented: async () => presented, dismiss, listFirstPage: async () => [] },
  )
  await reconcileDelivered({
    presented: async () => presented,
    dismiss,
    listFirstPage: async () => [],
  })
  assert.equal(dismiss.mock.callCount(), 0)
})

test("a tag is read percent-decoded from the identifier", async () => {
  const dismiss = mock.fn(async (_identifier: string) => undefined)
  const identifier = `expo-notifications://foreign_notifications?id=7&tag=${encodeURIComponent(N1)}`
  await clearDelivered(
    { kind: "clear", ids: [N1] },
    { presented: async () => [other(identifier)], dismiss, listFirstPage: async () => [] },
  )
  assert.deepEqual(
    dismiss.mock.calls.map((call) => call.arguments[0]),
    [identifier],
  )
})

test("delivered notifications that cannot be read leave nothing to clear or reconcile", async () => {
  expectConsoleWarn("[push] delivered notifications could not be read")
  const deps = {
    presented: async (): Promise<DeliveredNotification[]> => {
      throw new Error("unavailable")
    },
    dismiss: mock.fn(async (_identifier: string) => undefined),
    listFirstPage: mock.fn(async () => []),
  }
  await clearDelivered({ kind: "clear", all: true }, deps)
  await reconcileDelivered(deps)
  assert.equal(deps.dismiss.mock.callCount(), 0)
  assert.equal(deps.listFirstPage.mock.callCount(), 0)
})

test("one dismissal that fails does not stop the rest", async () => {
  expectConsoleWarn("[push] a delivered notification could not be dismissed")
  const dismiss = mock.fn(async (identifier: string) => {
    if (identifier === "first") throw new Error("gone")
    return undefined
  })
  await clearDelivered(
    { kind: "clear", ids: [N1, N2] },
    {
      presented: async () => [pushed(N1, "first"), pushed(N2, "second")],
      dismiss,
      listFirstPage: async () => [],
    },
  )
  assert.deepEqual(
    dismiss.mock.calls.map((call) => call.arguments[0]),
    ["first", "second"],
  )
})
