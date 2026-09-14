export const CLUSTER_IDLE_MS = 90

export interface IdleRunner {
  request: () => void
  flush: () => void
  dispose: () => void
}

export interface IdleRunnerOptions {
  intervalMs?: number
  now?: () => number
}

export function createIdleRunner(run: () => void, options: IdleRunnerOptions = {}): IdleRunner {
  const intervalMs = options.intervalMs ?? CLUSTER_IDLE_MS
  const now = options.now ?? Date.now
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastRunAt = Number.NEGATIVE_INFINITY

  const invoke = () => {
    timer = null
    lastRunAt = now()
    run()
  }

  const cancel = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  return {
    request: () => {
      if (timer !== null) return
      const waited = now() - lastRunAt
      if (waited >= intervalMs) {
        invoke()
        return
      }
      timer = setTimeout(invoke, intervalMs - waited)
    },
    flush: () => {
      cancel()
      invoke()
    },
    dispose: cancel,
  }
}
