import type { HapticsCapability } from "./types"

export const NOOP_HAPTICS: HapticsCapability = {
  selection(): void {},
  impactLight(): void {},
  success(): void {},
  error(): void {},
}
