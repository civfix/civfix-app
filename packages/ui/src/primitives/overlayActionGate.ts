export function overlayActionsDeferUntilClosed(os: string): boolean {
  return os === "ios"
}

export interface OverlayActionGate {
  choose(action: () => void): void
  reopened(): void
  settle(): void
  hasPending(): boolean
}

export function makeOverlayActionGate(deferUntilClosed: boolean): OverlayActionGate {
  let pending: (() => void) | null = null
  return {
    choose(action) {
      if (!deferUntilClosed) {
        action()
        return
      }
      pending = action
    },
    reopened() {
      pending = null
    },
    settle() {
      const action = pending
      pending = null
      action?.()
    },
    hasPending() {
      return pending !== null
    },
  }
}
