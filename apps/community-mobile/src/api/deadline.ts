export const SESSION_RESTORE_DEADLINE_MS = 8000

export class RequestDeadlineError extends Error {
  readonly deadlineMs: number

  constructor(deadlineMs: number) {
    super(`civfix: the request did not answer within ${deadlineMs}ms`)
    this.name = "RequestDeadlineError"
    this.deadlineMs = deadlineMs
  }
}

export function isRequestDeadlineError(err: unknown): err is RequestDeadlineError {
  if (err instanceof RequestDeadlineError) return true
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "RequestDeadlineError"
  )
}

interface SharedFlight<T> {
  result: Promise<T>
  controller: AbortController
  abortAt: number
  timer: ReturnType<typeof setTimeout> | undefined
  expired: boolean
}

/**
 * Callers that arrive while a request is in flight share it instead of sending a twin. Each keeps the
 * deadline it asked for, failing with a RequestDeadlineError at that moment; the request itself is
 * aborted only once the latest of those passes.
 */
export function sharedDeadlineRequest<T>(
  run: (signal: AbortSignal) => Promise<T>,
): (deadlineMs: number) => Promise<T> {
  let flight: SharedFlight<T> | null = null

  const armAbort = (current: SharedFlight<T>, deadlineMs: number): void => {
    clearTimeout(current.timer)
    current.abortAt = Date.now() + deadlineMs
    current.timer = setTimeout(() => {
      current.expired = true
      current.controller.abort()
    }, deadlineMs)
  }

  const start = (): SharedFlight<T> => {
    const controller = new AbortController()
    let current: SharedFlight<T> | null = null
    const result = run(controller.signal).finally(() => {
      clearTimeout(current?.timer)
      if (flight === current) flight = null
    })
    current = { result, controller, abortAt: 0, timer: undefined, expired: false }
    return current
  }

  return (deadlineMs) => {
    const current = flight ?? start()
    flight = current
    if (Date.now() + deadlineMs > current.abortAt) armAbort(current, deadlineMs)
    return new Promise<T>((resolve, reject) => {
      const own = setTimeout(() => reject(new RequestDeadlineError(deadlineMs)), deadlineMs)
      current.result.then(
        (value) => {
          clearTimeout(own)
          resolve(value)
        },
        (err: unknown) => {
          clearTimeout(own)
          reject(current.expired ? new RequestDeadlineError(deadlineMs) : err)
        },
      )
    })
  }
}
