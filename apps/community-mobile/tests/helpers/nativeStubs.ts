import type { StateStorage } from "zustand/middleware"

type TokenRead = { ok: true; token: string | null } | { ok: false }

interface HeaderOptions {
  headers?: Record<string, string>
  signal?: AbortSignal
}

interface StubControl {
  token: TokenRead
  session: () => Promise<unknown>
  logout: () => Promise<unknown>
  pushUnregister: () => Promise<unknown>
  updateSettings: (body: unknown) => Promise<unknown>
  endpoint: (name: string, body: unknown) => Promise<unknown>
}

export const calls: string[] = []

export const memory = new Map<string, string>()

const defaults = (): StubControl => ({
  token: { ok: true, token: null },
  session: async () => ({ authenticated: false, user: null, guestSmsEnabled: false }),
  logout: async () => ({ ok: true }),
  pushUnregister: async () => ({ ok: true }),
  updateSettings: async () => ({ user: null }),
  endpoint: async (name) => {
    throw new Error(`no stubbed response for api.${name}`)
  },
})

export const control: StubControl = defaults()

export function resetStubs(): void {
  calls.length = 0
  memory.clear()
  Object.assign(control, defaults())
}

export const storage = {
  getString: (key: string): string | undefined => memory.get(key),
  set: (key: string, value: string): void => {
    memory.set(key, value)
  },
  delete: (key: string): void => {
    memory.delete(key)
  },
}

export const mmkvStateStorage: StateStorage = {
  getItem: (name) => memory.get(name) ?? null,
  setItem: (name, value) => {
    memory.set(name, value)
  },
  removeItem: (name) => {
    memory.delete(name)
  },
}

export function tokenGeneration(): number {
  return 0
}

export async function readToken(): Promise<TokenRead> {
  calls.push("readToken")
  return control.token
}

export async function setToken(token: string): Promise<void> {
  calls.push(`setToken:${token}`)
  control.token = { ok: true, token }
}

export async function clearToken(): Promise<void> {
  calls.push("clearToken")
  control.token = { ok: true, token: null }
}

function endpoint(name: string, body: unknown): Promise<unknown> {
  calls.push(`api.${name}:${JSON.stringify(body)}`)
  return control.endpoint(name, body)
}

export const api = {
  session: (_options?: HeaderOptions): Promise<unknown> => {
    calls.push("api.session")
    return control.session()
  },
  logout: (options?: HeaderOptions): Promise<unknown> => {
    calls.push(`api.logout:${options?.headers?.Authorization ?? ""}`)
    return control.logout()
  },
  pushUnregister: (registration: { token: string }, options?: HeaderOptions): Promise<unknown> => {
    calls.push(`api.pushUnregister:${registration.token}:${options?.headers?.Authorization ?? ""}`)
    return control.pushUnregister()
  },
  updateSettings: (body: unknown): Promise<unknown> => {
    calls.push(`api.updateSettings:${JSON.stringify(body)}`)
    return control.updateSettings(body)
  },
  appleSignIn: (body: unknown): Promise<unknown> => endpoint("appleSignIn", body),
  googleSignIn: (body: unknown): Promise<unknown> => endpoint("googleSignIn", body),
  otpRequest: (body: unknown): Promise<unknown> => endpoint("otpRequest", body),
  otpVerify: (body: unknown): Promise<unknown> => endpoint("otpVerify", body),
  reverseLabel: (body: unknown): Promise<unknown> => endpoint("reverseLabel", body),
}

export const chatSocket = {
  disconnect: (): void => {
    calls.push("chatSocket.disconnect")
  },
}

export async function clearSecureBlobs(): Promise<void> {
  calls.push("clearSecureBlobs")
}

export const queryClient = {
  clear: (): void => {
    calls.push("queryClient.clear")
  },
  invalidateQueries: async ({ queryKey }: { queryKey: readonly unknown[] }): Promise<void> => {
    calls.push(`queryClient.invalidate:${JSON.stringify(queryKey)}`)
  },
}

export const queryKeys: Readonly<Record<string, readonly unknown[]>> = new Proxy(
  {},
  { get: (_target, name) => [String(name)] },
)

export function adoptViewer(_viewerId: string | null): void {}

export function discardViewerDrafts(): void {
  calls.push("discardViewerDrafts")
}

export function clearPersistedCache(): void {
  calls.push("clearPersistedCache")
}

export function purgeQueryCache(): void {
  calls.push("purgeQueryCache")
}

export function resumeCachePersistence(): void {
  calls.push("resumeCachePersistence")
}

export function resolveActiveLocale(): string {
  return "en"
}
