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

export async function withRequestDeadline<T>(
  deadlineMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  let expired = false
  const timer = setTimeout(() => {
    expired = true
    controller.abort()
  }, deadlineMs)

  try {
    return await run(controller.signal)
  } catch (err) {
    if (expired) throw new RequestDeadlineError(deadlineMs)
    throw err
  } finally {
    clearTimeout(timer)
  }
}
