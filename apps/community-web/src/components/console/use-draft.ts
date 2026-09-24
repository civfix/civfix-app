"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export interface DraftController<T> {
  draft: T
  setDraft: (next: T) => void
  patch: (partial: Partial<T>) => void
  dirty: boolean
  restored: boolean
  dismissRestored: () => void
  clear: () => void
}

export interface UseDraftOptions {
  skipRestore?: boolean
}

const DRAFT_VERSION = "v1"
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

interface DraftEnvelope {
  version: string
  savedAt: number
  owner: string
  value: unknown
}

const DRAFT_KEY_PREFIX = `civfix.console.draft.${DRAFT_VERSION}.`

export function consoleDraftKey(
  scope: string,
  id: string | null | undefined,
  owner: string | null = null,
): string {
  return `${DRAFT_KEY_PREFIX}${owner ?? "anon"}.${scope}.${id ?? "new"}`
}

export function consoleDraftOwner(key: string): string {
  if (!key.startsWith(DRAFT_KEY_PREFIX)) return "anon"
  return key.slice(DRAFT_KEY_PREFIX.length).split(".")[0] ?? "anon"
}

// Storage throws in private mode, when site data is blocked, or over quota. A draft is a
// convenience, so each failure degrades to "no draft" rather than breaking the form.
function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    return
  }
}

function storageRemove(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    return
  }
}

// Scopes retired when the event-zone fix changed what a saved time means. Nothing reads them any
// more, and they can hold an access code or an unsent message body, so they are removed on sight.
const RETIRED_SCOPE_PREFIXES = ["ticket.v1.", "broadcast.v1."]

function isRetiredDraftKey(key: string): boolean {
  if (!key.startsWith(DRAFT_KEY_PREFIX)) return false
  const afterOwner = key.slice(DRAFT_KEY_PREFIX.length).split(".").slice(1).join(".")
  return RETIRED_SCOPE_PREFIXES.some((prefix) => afterOwner.startsWith(prefix))
}

function sweepRetiredDrafts(): void {
  let keys: string[]
  try {
    keys = Object.keys(window.localStorage)
  } catch {
    return
  }
  for (const key of keys) if (isRetiredDraftKey(key)) storageRemove(key)
}

function parseEnvelope(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function restoreDraft<T>(key: string, raw: string, initial: T): T | null {
  const envelope = parseEnvelope(raw)
  if (typeof envelope !== "object" || envelope === null || Array.isArray(envelope)) return null
  const { version, savedAt, owner, value } = envelope as Partial<DraftEnvelope>
  if (version !== DRAFT_VERSION) return null
  if (typeof savedAt !== "number" || Date.now() - savedAt > DRAFT_MAX_AGE_MS) return null
  if (owner !== consoleDraftOwner(key)) return null
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  const restored = { ...initial } as Record<string, unknown>
  for (const [field, saved] of Object.entries(value as Record<string, unknown>)) {
    const expected = (initial as Record<string, unknown>)[field]
    if (expected === undefined) continue
    if (Array.isArray(expected) !== Array.isArray(saved)) continue
    if (typeof expected !== typeof saved) continue
    restored[field] = saved
  }
  return restored as T
}

function readDraft<T>(key: string, initial: T): T | null {
  if (typeof window === "undefined") return null
  const raw = storageGet(key)
  if (!raw) return null
  const restored = restoreDraft(key, raw, initial)
  if (restored === null) storageRemove(key)
  return restored
}

export function useDraft<T extends object>(
  key: string,
  initial: T,
  options?: UseDraftOptions,
): DraftController<T> {
  const skipRestore = options?.skipRestore ?? false
  const initialRef = useRef(initial)
  const [draft, setDraftState] = useState<T>(initial)
  const [dirty, setDirty] = useState(false)
  const [restored, setRestored] = useState(false)
  const [activeKey, setActiveKey] = useState(key)
  const loaded = useRef(false)

  if (key !== activeKey) {
    setActiveKey(key)
    setDirty(false)
    initialRef.current = initial
    if (skipRestore) {
      setDraftState(initial)
      setRestored(false)
    } else {
      const saved = readDraft(key, initial)
      setDraftState(saved ?? initial)
      setRestored(saved !== null)
    }
  }

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    sweepRetiredDrafts()
    if (skipRestore) return
    const saved = readDraft(key, initialRef.current)
    if (saved) {
      setDraftState(saved)
      setRestored(true)
    }
  }, [key, skipRestore])

  useEffect(() => {
    if (!dirty || typeof window === "undefined") return
    const envelope: DraftEnvelope = {
      version: DRAFT_VERSION,
      savedAt: Date.now(),
      owner: consoleDraftOwner(key),
      value: draft,
    }
    storageSet(key, JSON.stringify(envelope))
  }, [draft, dirty, key])

  const setDraft = useCallback((next: T) => {
    setDirty(true)
    setDraftState(next)
  }, [])

  const patch = useCallback((partial: Partial<T>) => {
    setDirty(true)
    setDraftState((current) => ({ ...current, ...partial }))
  }, [])

  const dismissRestored = useCallback(() => setRestored(false), [])

  const clear = useCallback(() => {
    if (typeof window !== "undefined") storageRemove(key)
    setDraftState(initialRef.current)
    setDirty(false)
    setRestored(false)
  }, [key])

  return { draft, setDraft, patch, dirty, restored, dismissRestored, clear }
}
