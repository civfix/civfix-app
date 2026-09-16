"use client"


const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
const SCRIPT_ID = "cf-turnstile-script"
const API_POLL_INTERVAL_MS = 50
const API_READY_TIMEOUT_MS = 3000
const SCRIPT_LOAD_TIMEOUT_MS = 15000
const MINT_TIMEOUT_MS = 20000
const INTERACTIVE_TIMEOUT_MS = 120000
const HOST_Z_INDEX = 10500

export const TURNSTILE_SITEKEY: string | undefined = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY

export const TURNSTILE_ACTION_ANON_REPORT = "anon-report"
export const TURNSTILE_ACTION_HOME_TURF = "home-turf"

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string
      action?: string
      callback?: (token: string) => void
      "error-callback"?: (code?: string) => void
      "expired-callback"?: () => void
      "before-interactive-callback"?: () => void
      "after-interactive-callback"?: () => void
      appearance?: "always" | "execute" | "interaction-only"
    },
  ) => string
  remove: (id?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
    onloadTurnstileCallback?: () => void
  }
}

let scriptPromise: Promise<void> | null = null

function turnstileReady(): boolean {
  return typeof window !== "undefined" && typeof window.turnstile?.render === "function"
}

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (turnstileReady()) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  const pending = new Promise<void>((resolve, reject) => {
    let poll: ReturnType<typeof setInterval> | null = null
    let deadline: ReturnType<typeof setTimeout> | null = null
    const stopWatching = () => {
      if (poll !== null) clearInterval(poll)
      if (deadline !== null) clearTimeout(deadline)
      poll = null
      deadline = null
    }
    const fail = () => {
      stopWatching()
      document.getElementById(SCRIPT_ID)?.remove()
      reject(new Error("Turnstile script failed to load"))
    }
    const settleWhenReady = (): boolean => {
      if (!turnstileReady()) return false
      stopWatching()
      resolve()
      return true
    }
    const watchForApi = (timeoutMs: number) => {
      if (settleWhenReady()) return
      stopWatching()
      poll = setInterval(settleWhenReady, API_POLL_INTERVAL_MS)
      deadline = setTimeout(fail, timeoutMs)
    }

    const existing = document.getElementById(SCRIPT_ID)
    if (existing) {
      if (settleWhenReady()) return
      existing.addEventListener("load", () => watchForApi(API_READY_TIMEOUT_MS))
      existing.addEventListener("error", fail)
      watchForApi(SCRIPT_LOAD_TIMEOUT_MS)
      return
    }
    const script = document.createElement("script")
    script.id = SCRIPT_ID
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => watchForApi(API_READY_TIMEOUT_MS)
    script.onerror = fail
    document.head.appendChild(script)
  })
  void pending.catch(() => {
    if (scriptPromise === pending) scriptPromise = null
  })
  scriptPromise = pending
  return pending
}

function createHost(): { frame: HTMLElement; widget: HTMLElement } {
  const frame = document.createElement("div")
  frame.style.position = "fixed"
  frame.style.left = "0"
  frame.style.right = "0"
  frame.style.bottom = "0"
  frame.style.display = "flex"
  frame.style.justifyContent = "center"
  frame.style.paddingBottom = "calc(env(safe-area-inset-bottom, 0px) + 16px)"
  frame.style.zIndex = String(HOST_Z_INDEX)
  frame.style.pointerEvents = "none"

  const widget = document.createElement("div")
  widget.style.pointerEvents = "auto"

  frame.appendChild(widget)
  document.body.appendChild(frame)
  return { frame, widget }
}

function mintToken(action: string, timeoutMs: number): Promise<string> {
  return new Promise<string>((resolve) => {
    let settled = false
    let widgetId: string | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    const { frame, widget } = createHost()

    const removeWidget = () => {
      const id = widgetId
      widgetId = null
      if (id === null || !window.turnstile) return
      try {
        window.turnstile.remove(id)
      } catch {
        console.warn("[turnstile] widget teardown failed", { action })
      }
    }

    const settle = (token: string) => {
      if (settled) return
      settled = true
      if (timer !== null) clearTimeout(timer)
      removeWidget()
      frame.remove()
      resolve(token)
    }

    const armDeadline = (ms: number) => {
      if (settled) return
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => settle(""), ms)
    }

    armDeadline(timeoutMs)

    loadTurnstileScript()
      .then(() => {
        if (settled) return
        const api = window.turnstile
        if (!api || typeof api.render !== "function") {
          console.warn("[turnstile] api unavailable after script load", { action })
          return settle("")
        }
        widgetId = api.render(widget, {
          sitekey: TURNSTILE_SITEKEY as string,
          action,
          appearance: "interaction-only",
          callback: (token) => settle(token),
          "before-interactive-callback": () => armDeadline(INTERACTIVE_TIMEOUT_MS),
          "after-interactive-callback": () => armDeadline(timeoutMs),
          "error-callback": (code) => {
            console.warn("[turnstile] error-callback", { action, code: code ?? "unknown" })
            settle("")
          },
          "expired-callback": () => {
            console.warn("[turnstile] expired-callback", { action })
            settle("")
          },
        })
        if (settled) removeWidget()
      })
      .catch(() => {
        console.warn("[turnstile] mint failed before a token was issued", { action })
        settle("")
      })
  })
}

let mintChain: Promise<unknown> = Promise.resolve()
let pendingMint: { action: string; promise: Promise<string> } | null = null

export function runTurnstile(
  action: string = TURNSTILE_ACTION_ANON_REPORT,
  timeoutMs = MINT_TIMEOUT_MS,
): Promise<string> {
  if (typeof window === "undefined" || !TURNSTILE_SITEKEY) return Promise.resolve("")
  if (pendingMint !== null && pendingMint.action === action) return pendingMint.promise

  const start = () => mintToken(action, timeoutMs)
  const promise = mintChain.then(start, start)
  const entry = { action, promise }
  pendingMint = entry
  const clear = () => {
    if (pendingMint === entry) pendingMint = null
  }
  mintChain = promise.then(clear, clear)
  return promise
}
