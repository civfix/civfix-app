"use client"

import { useCallback, useSyncExternalStore } from "react"

export const CONSOLE_REPLACE_PARAM_KEYS = [
  "tab",
  "q",
  "status",
  "ticket",
  "slot",
  "who",
  "checked",
  "sort",
  "cursor",
  "range",
  "grain",
  "block",
  "preview",
  "next",
  "stripe",
] as const

export const CONSOLE_PUSH_PARAM_KEYS = [
  "attendee",
  "tt",
  "member",
  "delivery",
  "confirm",
] as const

export const CONSOLE_PARAM_KEYS = [
  ...CONSOLE_REPLACE_PARAM_KEYS,
  ...CONSOLE_PUSH_PARAM_KEYS,
] as const

export type ConsoleReplaceParamKey = (typeof CONSOLE_REPLACE_PARAM_KEYS)[number]
export type ConsolePushParamKey = (typeof CONSOLE_PUSH_PARAM_KEYS)[number]
export type ConsoleParamKey = (typeof CONSOLE_PARAM_KEYS)[number]

export type ConsoleParams = Partial<Record<ConsoleParamKey, string>>
export type ConsoleParamPatch = Partial<Record<ConsoleParamKey, string | null>>
export type UrlWriteMode = "push" | "replace"

const URL_STATE_EVENT = "civfix-console:urlstate"

const KNOWN_KEYS = new Set<string>(CONSOLE_PARAM_KEYS)
const PUSH_KEYS = new Set<string>(CONSOLE_PUSH_PARAM_KEYS)

export function isConsoleParamKey(key: string): key is ConsoleParamKey {
  return KNOWN_KEYS.has(key)
}

export function isDrawerParamKey(key: string): key is ConsolePushParamKey {
  return PUSH_KEYS.has(key)
}

export function parseConsoleSearch(search: string): ConsoleParams {
  const params: ConsoleParams = {}
  const query = new URLSearchParams(search)
  for (const [key, value] of query.entries()) {
    if (KNOWN_KEYS.has(key) && value !== "") params[key as ConsoleParamKey] = value
  }
  return params
}

export function serializeConsoleParams(params: ConsoleParams): string {
  const query = new URLSearchParams()
  for (const key of CONSOLE_PARAM_KEYS) {
    const value = params[key]
    if (value !== undefined && value !== "") query.set(key, value)
  }
  const out = query.toString()
  return out === "" ? "" : `?${out}`
}

export function applyConsolePatch(
  params: ConsoleParams,
  patch: ConsoleParamPatch,
): ConsoleParams {
  const next: ConsoleParams = { ...params }
  for (const [key, value] of Object.entries(patch) as [
    ConsoleParamKey,
    string | null | undefined,
  ][]) {
    if (!KNOWN_KEYS.has(key)) continue
    if (value === null || value === undefined || value === "") delete next[key]
    else next[key] = value
  }
  return next
}

export function writeModeForPatch(patch: ConsoleParamPatch): UrlWriteMode {
  for (const [key, value] of Object.entries(patch) as [
    ConsoleParamKey,
    string | null | undefined,
  ][]) {
    if (PUSH_KEYS.has(key) && typeof value === "string" && value !== "") return "push"
  }
  return "replace"
}

export function consoleHref(pathname: string, params: ConsoleParams): string {
  return `${pathname}${serializeConsoleParams(params)}`
}

let lastSearch: string | null = null
let lastParams: ConsoleParams = {}
const EMPTY_PARAMS: ConsoleParams = {}

function paramsSnapshot(): ConsoleParams {
  if (typeof window === "undefined") return EMPTY_PARAMS
  const search = window.location.search
  if (search !== lastSearch) {
    lastSearch = search
    lastParams = parseConsoleSearch(search)
  }
  return lastParams
}

function serverParamsSnapshot(): ConsoleParams {
  return EMPTY_PARAMS
}

let historyPatched = false

function ensureHistoryPatched(): void {
  if (historyPatched || typeof window === "undefined") return
  historyPatched = true
  const originalPush = window.history.pushState.bind(window.history)
  const originalReplace = window.history.replaceState.bind(window.history)
  window.history.pushState = (...args: Parameters<History["pushState"]>) => {
    originalPush(...args)
    window.dispatchEvent(new Event(URL_STATE_EVENT))
  }
  window.history.replaceState = (...args: Parameters<History["replaceState"]>) => {
    originalReplace(...args)
    window.dispatchEvent(new Event(URL_STATE_EVENT))
  }
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  ensureHistoryPatched()
  window.addEventListener("popstate", onChange)
  window.addEventListener("hashchange", onChange)
  window.addEventListener(URL_STATE_EVENT, onChange)
  return () => {
    window.removeEventListener("popstate", onChange)
    window.removeEventListener("hashchange", onChange)
    window.removeEventListener(URL_STATE_EVENT, onChange)
  }
}

export function getConsoleParams(): ConsoleParams {
  return paramsSnapshot()
}

export function setConsoleParams(patch: ConsoleParamPatch, mode?: UrlWriteMode): void {
  if (typeof window === "undefined") return
  const next = applyConsolePatch(paramsSnapshot(), patch)
  const href = `${window.location.pathname}${serializeConsoleParams(next)}${window.location.hash}`
  const resolved = mode ?? writeModeForPatch(patch)
  if (resolved === "push")
    window.history.pushState({ ...window.history.state, consoleDrawer: true }, "", href)
  else window.history.replaceState(window.history.state, "", href)
  window.dispatchEvent(new Event(URL_STATE_EVENT))
}

export type DrawerClosePlan = "back" | "replace"

/**
 * HOW A DRAWER CLOSES. Opening one PUSHES a history entry (its param is in CONSOLE_PUSH_PARAM_KEYS), so
 * dropping the param with a replace would leave that entry behind and a browser Back would re-open the
 * drawer instead of returning to the previous console screen. When the current entry is the drawer's own,
 * closing is a real traversal; only an entry this console did not push falls back to the replace patch.
 */
export function drawerClosePlan(state: unknown): DrawerClosePlan {
  if (typeof state !== "object" || state === null) return "replace"
  return (state as Record<string, unknown>).consoleDrawer === true ? "back" : "replace"
}

export function closeConsoleDrawer(keys: readonly ConsoleParamKey[]): void {
  if (typeof window === "undefined") return
  if (drawerClosePlan(window.history.state) === "back") {
    window.history.back()
    return
  }
  const patch: ConsoleParamPatch = {}
  for (const key of keys) patch[key] = null
  setConsoleParams(patch, "replace")
}

export function navigateConsole(pathname: string, params: ConsoleParams = {}): void {
  if (typeof window === "undefined") return
  window.history.pushState(null, "", consoleHref(pathname, params))
  window.dispatchEvent(new Event(URL_STATE_EVENT))
}

export function notifyConsoleUrlChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(URL_STATE_EVENT))
}

export interface ConsoleUrlState {
  params: ConsoleParams
  get: (key: ConsoleParamKey) => string | undefined
  set: (patch: ConsoleParamPatch, mode?: UrlWriteMode) => void
}

export function useConsoleUrlState(): ConsoleUrlState {
  const params = useSyncExternalStore(subscribe, paramsSnapshot, serverParamsSnapshot)
  const get = useCallback((key: ConsoleParamKey) => params[key], [params])
  const set = useCallback((patch: ConsoleParamPatch, mode?: UrlWriteMode) => {
    setConsoleParams(patch, mode)
  }, [])
  return { params, get, set }
}

export function useConsolePathname(): string {
  return useSyncExternalStore(
    subscribe,
    () => (typeof window === "undefined" ? "/manage/" : window.location.pathname),
    () => "/manage/",
  )
}

/**
 * `location.search + location.hash`, for the routes that are addressed by a parameter outside the
 * console's own `CONSOLE_PARAM_KEYS` (the org invite `token`, which the emailed link carries in the
 * fragment). Same subscription as the pathname, plus `hashchange`, so a navigation that changes
 * only the query or fragment re-renders the router.
 */
export function useConsoleQuery(): string {
  return useSyncExternalStore(
    subscribe,
    () => (typeof window === "undefined" ? "" : `${window.location.search}${window.location.hash}`),
    () => "",
  )
}
