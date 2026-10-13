import assert from "node:assert/strict"
import { test } from "node:test"
import { whenNavigationReady, type NavigationReadiness } from "./navigationReady.ts"

function fakeContainer(ready: boolean) {
  const listeners = new Set<() => void>()
  const container: NavigationReadiness & { ready: boolean; emitReady: () => void; listeners: Set<() => void> } = {
    ready,
    listeners,
    isReady: () => container.ready,
    addListener: (_event, callback) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    emitReady: () => {
      container.ready = true
      for (const callback of [...listeners]) callback()
    },
  }
  return container
}

test("a ready container runs the navigation straight away", () => {
  const container = fakeContainer(true)
  let runs = 0
  whenNavigationReady(container, () => (runs += 1))
  assert.equal(runs, 1)
  assert.equal(container.listeners.size, 0)
})

test("after a Back-exit remount the navigation waits until the root navigator has mounted", () => {
  const container = fakeContainer(false)
  let runs = 0
  whenNavigationReady(container, () => (runs += 1))
  assert.equal(runs, 0)
  container.emitReady()
  assert.equal(runs, 1)
  assert.equal(container.listeners.size, 0)
  container.emitReady()
  assert.equal(runs, 1)
})

test("a host that unmounts before the container is ready never navigates", () => {
  const container = fakeContainer(false)
  let runs = 0
  const cancel = whenNavigationReady(container, () => (runs += 1))
  cancel()
  container.emitReady()
  assert.equal(runs, 0)
  assert.equal(container.listeners.size, 0)
})
