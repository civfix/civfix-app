import type { TokenRead } from "@/auth/storage"

const BEARER = /^bearer\s+(\S+)$/i

function headerValue(headers: HeadersInit, name: string): string | null {
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name)
  }
  if (Array.isArray(headers)) {
    const pair = headers.find(([key]) => key.toLowerCase() === name)
    return pair ? pair[1] : null
  }
  for (const [key, value] of Object.entries(headers as Record<string, string>)) {
    if (key.toLowerCase() === name) return value
  }
  return null
}

export function carriedBearerToken(headers: HeadersInit | undefined): string | null {
  if (!headers) return null
  const value = headerValue(headers, "authorization")
  if (typeof value !== "string") return null
  const match = BEARER.exec(value.trim())
  return match ? match[1]! : null
}

export interface SessionTeardownDeps {
  readToken: () => Promise<TokenRead>
  clearToken: () => Promise<void>
  onTornDown: () => void
}

export function makeSessionTeardown(deps: SessionTeardownDeps): (bearer: string) => Promise<void> {
  return async (bearer) => {
    const read = await deps.readToken()
    if (!read.ok) return
    if (read.token !== bearer) return
    await deps.clearToken()
    deps.onTornDown()
  }
}

export function makeSingleFlight<A extends unknown[]>(
  keyOf: (...args: A) => string,
  run: (...args: A) => Promise<void>,
  onError: (err: unknown) => void,
): (...args: A) => void {
  const inFlight = new Set<string>()
  return (...args: A) => {
    const key = keyOf(...args)
    if (inFlight.has(key)) return
    inFlight.add(key)
    void run(...args)
      .catch(onError)
      .finally(() => {
        inFlight.delete(key)
      })
  }
}
