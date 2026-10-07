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
  assert.equal(memory.get(ONBOARDING_KEY), JSON.stringify({ state: { completedVersion: 1 }, version: 1 }))
})

test("a replay request, presenting and the gate are session-only", async () => {
  memory.set(ONBOARDING_KEY, JSON.stringify({ state: { completedVersion: 1 }, version: 1 }))
  const { useOnboardingStore } = await freshModule()
  useOnboardingStore.getState().replay()
  useOnboardingStore.getState().setGateActive(false)
  assert.equal(memory.get(ONBOARDING_KEY), JSON.stringify({ state: { completedVersion: 1 }, version: 1 }))
  const { useOnboardingStore: relaunched } = await freshModule()
  assert.deepEqual(onboarding(relaunched), {
    completedVersion: 1,
    replayRequested: false,
    presenting: false,
    gateActive: true,
  })
})
