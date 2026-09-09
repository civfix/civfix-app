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

function readDraft<T>(key: string, initial: T): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const envelope: unknown = JSON.parse(raw)
    if (typeof envelope !== "object" || envelope === null || Array.isArray(envelope)) return null
    const { version, savedAt, owner, value } = envelope as Partial<DraftEnvelope>
    if (version !== DRAFT_VERSION) throw new Error("stale draft")
    if (typeof savedAt !== "number" || Date.now() - savedAt > DRAFT_MAX_AGE_MS) {
      throw new Error("expired draft")
    }
    if (owner !== consoleDraftOwner(key)) throw new Error("draft belongs to another account")
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("malformed draft")
    }
    const restored = { ...initial } as Record<string, unknown>
    for (const [field, saved] of Object.entries(value as Record<string, unknown>)) {
      const expected = (initial as Record<string, unknown>)[field]
      if (expected === undefined) continue
      if (Array.isArray(expected) !== Array.isArray(saved)) continue
      if (typeof expected !== typeof saved) continue
      restored[field] = saved
    }
    return restored as T
  } catch {
    try {
      window.localStorage.removeItem(key)
    } catch {}
    return null
  }
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
    if (skipRestore) return
    const saved = readDraft(key, initialRef.current)
    if (saved) {
      setDraftState(saved)
      setRestored(true)
    }
  }, [key, skipRestore])

  useEffect(() => {
    if (!dirty || typeof window === "undefined") return
    try {
      const envelope: DraftEnvelope = {
        version: DRAFT_VERSION,
        savedAt: Date.now(),
        owner: consoleDraftOwner(key),
        value: draft,
      }
      window.localStorage.setItem(key, JSON.stringify(envelope))
    } catch {}
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
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(key)
      } catch {
      }
    }
    setDraftState(initialRef.current)
    setDirty(false)
    setRestored(false)
  }, [key])

  return { draft, setDraft, patch, dirty, restored, dismissRestored, clear }
}
