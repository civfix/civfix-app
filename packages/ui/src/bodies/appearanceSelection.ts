import type { AppearancePreference } from "../theme"

export interface AppearancePending {
  target: AppearancePreference
  from: AppearancePreference
}

export interface AppearanceRowState {
  selected: boolean
  pending: boolean
}

export type AppearanceCommit =
  | { kind: "idle" }
  | { kind: "clear" }
  | { kind: "apply"; preference: AppearancePreference }

function appearanceSelection(
  pending: AppearancePending | null,
  applied: AppearancePreference,
): AppearancePreference {
  return pending?.target ?? applied
}

export function appearanceRowState(
  code: AppearancePreference,
  pending: AppearancePending | null,
  applied: AppearancePreference,
): AppearanceRowState {
  return {
    selected: code === appearanceSelection(pending, applied),
    pending: pending !== null && code === pending.target && pending.target !== applied,
  }
}

export function appearancePressTarget(
  code: AppearancePreference,
  pending: AppearancePending | null,
  applied: AppearancePreference,
): AppearancePending | null {
  if (code === appearanceSelection(pending, applied)) return pending
  return { target: code, from: applied }
}

export function appearanceCommit(
  pending: AppearancePending | null,
  applied: AppearancePreference,
): AppearanceCommit {
  if (pending === null) return { kind: "idle" }
  if (pending.target === applied) return { kind: "clear" }
  if (pending.from !== applied) return { kind: "clear" }
  return { kind: "apply", preference: pending.target }
}

export type FrameScheduler = (callback: () => void) => number
export type FrameCanceller = (handle: number) => void

const defaultSchedule: FrameScheduler = (callback) => requestAnimationFrame(callback)
const defaultCancel: FrameCanceller = (handle) => cancelAnimationFrame(handle)

export function scheduleAfterPaint(
  run: () => void,
  schedule: FrameScheduler = defaultSchedule,
  cancel: FrameCanceller = defaultCancel,
): () => void {
  let handle = schedule(() => {
    handle = schedule(run)
  })
  return () => cancel(handle)
}
