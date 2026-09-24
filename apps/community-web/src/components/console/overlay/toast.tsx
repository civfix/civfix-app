"use client"

import { X } from "lucide-react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { FocusEvent, ReactNode } from "react"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

import { DEFAULT_TOAST_DURATION_MS, withinCap } from "./toast-policy"

export type ToastTone = "default" | "success" | "danger"

export interface ToastOptions {
  title: string
  description?: string
  tone?: ToastTone
  durationMs?: number
}

interface ToastItem extends ToastOptions {
  id: string
  expiresAt: number | null
  pausedRemainingMs: number | null
}

export interface ConsoleToastApi {
  toast: (options: ToastOptions) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ConsoleToastApi | null>(null)

export function useConsoleToast(): ConsoleToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error("useConsoleToast must be used within ConsoleToastProvider")
  return api
}

const TONE_ACCENT: Record<ToastTone, string> = {
  default: "bg-console-sky-strong",
  success: "bg-console-moss-strong",
  danger: "bg-console-bloom-strong",
}

export function ConsoleToastProvider({ children }: { children: ReactNode }) {
  const { t } = useT("host-common")
  const [items, setItems] = useState<ToastItem[]>([])
  const itemsRef = useRef(items)
  itemsRef.current = items
  const counter = useRef(0)
  const timers = useRef(new Map<string, number>())
  const stackRef = useRef<HTMLElement>(null)
  const pointerInside = useRef(false)
  const paused = useRef(false)

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const handle of pending.values()) window.clearTimeout(handle)
      pending.clear()
    }
  }, [])

  const clearTimer = useCallback((id: string) => {
    const handle = timers.current.get(id)
    if (handle === undefined) return
    window.clearTimeout(handle)
    timers.current.delete(id)
  }, [])

  const schedule = useCallback(
    (id: string, ms: number) => {
      clearTimer(id)
      const handle = window.setTimeout(() => {
        timers.current.delete(id)
        setItems((prev) => prev.filter((existing) => existing.id !== id))
      }, ms)
      timers.current.set(id, handle)
    },
    [clearTimer],
  )

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
    },
    [clearTimer],
  )

  const setPaused = useCallback(
    (next: boolean) => {
      if (next === paused.current) return
      paused.current = next
      const now = Date.now()
      if (next) {
        for (const handle of timers.current.values()) window.clearTimeout(handle)
        timers.current.clear()
        setItems(
          itemsRef.current.map((item) =>
            item.expiresAt === null
              ? item
              : { ...item, pausedRemainingMs: Math.max(0, item.expiresAt - now) },
          ),
        )
        return
      }
      const resumed = itemsRef.current.map((item) =>
        item.pausedRemainingMs === null
          ? item
          : { ...item, expiresAt: now + item.pausedRemainingMs, pausedRemainingMs: null },
      )
      for (const item of resumed) {
        if (item.expiresAt !== null) schedule(item.id, item.expiresAt - now)
      }
      setItems(resumed)
    },
    [schedule],
  )

  // Timed toasts hold while the pointer or keyboard focus is on them (WCAG 2.2.1), so one cannot
  // expire while someone is still reading or operating it.
  const syncPause = useCallback(
    (focusTarget: EventTarget | null) => {
      const stack = stackRef.current
      const focused = stack !== null && focusTarget instanceof Node && stack.contains(focusTarget)
      setPaused(pointerInside.current || focused)
    },
    [setPaused],
  )

  useEffect(() => {
    // A toast removed from under the pointer does not reliably fire pointerleave on the stack, and an
    // empty stack has no hit area left to leave, so a stale hover would hold every later toast.
    if (items.length === 0) pointerInside.current = false
    if (typeof document !== "undefined") syncPause(document.activeElement)
  }, [items, syncPause])

  const toast = useCallback(
    (options: ToastOptions) => {
      counter.current += 1
      const id = `console-toast-${counter.current}`
      const duration = options.durationMs ?? DEFAULT_TOAST_DURATION_MS
      const timed = duration > 0
      const item: ToastItem = {
        ...options,
        id,
        expiresAt: timed ? Date.now() + duration : null,
        pausedRemainingMs: timed && paused.current ? duration : null,
      }
      setItems((prev) => withinCap(prev, item))
      if (timed && !paused.current) schedule(id, duration)
      return id
    },
    [schedule],
  )

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  const polite = items.filter((item) => item.tone !== "danger")
  const assertive = items.filter((item) => item.tone === "danger")

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="sr-only" role="status" aria-live="polite">
        {polite.map((item) => (
          <p key={item.id}>
            {item.description ? `${item.title}. ${item.description}` : item.title}
          </p>
        ))}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive">
        {assertive.map((item) => (
          <p key={item.id}>
            {item.description ? `${item.title}. ${item.description}` : item.title}
          </p>
        ))}
      </div>
      <section
        ref={stackRef}
        aria-label={t("toast.region")}
        onPointerEnter={() => {
          pointerInside.current = true
          syncPause(document.activeElement)
        }}
        onPointerLeave={() => {
          pointerInside.current = false
          syncPause(document.activeElement)
        }}
        onFocus={(event: FocusEvent) => syncPause(event.target)}
        onBlur={(event: FocusEvent) => syncPause(event.relatedTarget)}
        className="pointer-events-none fixed bottom-token-4 right-token-4 z-[70] flex w-[min(360px,calc(100vw-theme(spacing.token-8)))] flex-col gap-token-2"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto relative flex items-start gap-token-3 overflow-hidden rounded-sm bg-console-toast-surface py-token-3 pl-token-4 pr-token-2 text-console-toast-ink shadow-console-3",
              "animate-in fade-in slide-in-from-bottom-2 duration-d2 ease-out",
            )}
          >
            <span
              aria-hidden
              className={cn("absolute inset-y-0 left-0 w-1", TONE_ACCENT[item.tone ?? "default"])}
            />
            <div className="min-w-0 flex-1">
              <p className="text-token-13 font-semibold">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 text-token-12 text-console-toast-ink-dim">
                  {item.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label={t("action.dismiss")}
              onClick={() => dismiss(item.id)}
              className="shrink-0 rounded-xs p-1 text-console-toast-ink-dim hover:text-console-toast-ink focus-visible:outline-none focus-visible:shadow-console-ring"
            >
              <X aria-hidden className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </section>
    </ToastContext.Provider>
  )
}
