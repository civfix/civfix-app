import { beforeEach, test } from "node:test"
import assert from "node:assert/strict"
import { installModuleStubs } from "../../tests/helpers/moduleHooks.ts"
import type * as OnboardingModule from "./onboardingStore.ts"

const STUBS = new URL("../../tests/helpers/nativeStubs.ts", import.meta.url)
installModuleStubs({ "@/lib/mmkv": STUBS })

const { memory, resetStubs } = await import("../../tests/helpers/nativeStubs.ts")
const { ONBOARDING_KEY } = await import("../lib/mmkvKeys.ts")

let instance = 0

async function freshModule(): Promise<typeof OnboardingModule> {
  instance += 1
  return (await import(`./onboardingStore.ts?instance=${instance}`)) as typeof OnboardingModule
}

function onboarding(store: Awaited<ReturnType<typeof freshModule>>["useOnboardingStore"]) {
  const { completedVersion, replayRequested, presenting, gateActive } = store.getState()
  return { completedVersion, replayRequested, presenting, gateActive }
}

beforeEach(() => {
  resetStubs()
})

test("a fresh install has not completed onboarding and starts with the gate active", async () => {
  const { useOnboardingStore, ONBOARDING_VERSION } = await freshModule()
  assert.equal(ONBOARDING_VERSION, 1)
  assert.deepEqual(onboarding(useOnboardingStore), {
    completedVersion: 0,
    replayRequested: false,
    presenting: false,
    gateActive: true,
  })
})

test("completing onboarding records the current version and persists only that", async () => {
  const { useOnboardingStore } = await freshModule()
  useOnboardingStore.getState().replay()
  useOnboardingStore.getState().setPresenting(true)
  useOnboardingStore.getState().complete()
  assert.deepEqual(onboarding(useOnboardingStore), {
    completedVersion: 1,
    replayRequested: false,
    presenting: true,
    gateActive: true,
  })
  assert.equal(
    memory.get(ONBOARDING_KEY),
    JSON.stringify({ state: { completedVersion: 1 }, version: 1 }),
  )
})

test("a replay request, presenting and the gate are session-only", async () => {
  memory.set(ONBOARDING_KEY, JSON.stringify({ state: { completedVersion: 1 }, version: 1 }))
  const { useOnboardingStore } = await freshModule()
  useOnboardingStore.getState().replay()
  useOnboardingStore.getState().setGateActive(false)
  assert.equal(
    memory.get(ONBOARDING_KEY),
    JSON.stringify({ state: { completedVersion: 1 }, version: 1 }),
  )
  const { useOnboardingStore: relaunched } = await freshModule()
  assert.deepEqual(onboarding(relaunched), {
    completedVersion: 1,
    replayRequested: false,
    presenting: false,
    gateActive: true,
  })
})

const { shouldShowOnboarding } = await import("../lib/onboardingPlan.ts")

const COMPLETED = JSON.stringify({ state: { completedVersion: 1 }, version: 1 })
const NOT_COMPLETED = JSON.stringify({ state: { completedVersion: 0 }, version: 1 })

function eligibleToShow(
  store: Awaited<ReturnType<typeof freshModule>>["useOnboardingStore"],
): boolean {
  const { completedVersion, replayRequested } = store.getState()
  return shouldShowOnboarding({
    completedVersion,
    currentVersion: 1,
    replayRequested,
    gateActive: false,
    authStatus: "unauthed",
    profileIncomplete: false,
  })
}

test("T7: a reset stores the tour as not completed while this session stays completed", async () => {
  memory.set(ONBOARDING_KEY, COMPLETED)
  const { useOnboardingStore } = await freshModule()
  useOnboardingStore.getState().resetForNextLaunch()
  assert.equal(useOnboardingStore.getState().completedVersion, 1)
  assert.equal(useOnboardingStore.getState().replayRequested, false)
  assert.equal(eligibleToShow(useOnboardingStore), false)
  assert.equal(memory.get(ONBOARDING_KEY), NOT_COMPLETED)
})

test("T8: the next launch after a reset shows the tour", async () => {
  memory.set(ONBOARDING_KEY, COMPLETED)
  const { useOnboardingStore } = await freshModule()
  useOnboardingStore.getState().resetForNextLaunch()
  const { useOnboardingStore: relaunched } = await freshModule()
  assert.equal(relaunched.getState().completedVersion, 0)
  assert.equal(eligibleToShow(relaunched), true)
})

test("T9: later session writes keep the reset stored", async () => {
  memory.set(ONBOARDING_KEY, COMPLETED)
  const { useOnboardingStore } = await freshModule()
  useOnboardingStore.getState().resetForNextLaunch()
  useOnboardingStore.getState().setPresenting(true)
  useOnboardingStore.getState().setPresenting(false)
  useOnboardingStore.getState().setGateActive(false)
  assert.equal(memory.get(ONBOARDING_KEY), NOT_COMPLETED)
})

test("T10: a tour finished after the reset counts as done", async () => {
  memory.set(ONBOARDING_KEY, COMPLETED)
  const { useOnboardingStore } = await freshModule()
  useOnboardingStore.getState().resetForNextLaunch()
  useOnboardingStore.getState().replay()
  useOnboardingStore.getState().complete()
  assert.equal(memory.get(ONBOARDING_KEY), COMPLETED)
})
