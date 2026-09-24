"use client"

import { useEffect, useState } from "react"
import { ErrorCode } from "@civfix/shared"

import { toAppError } from "@/lib/api"

function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return
    const apply = () => setOffline(navigator.onLine === false)
    apply()
    window.addEventListener("online", apply)
    window.addEventListener("offline", apply)
    return () => {
      window.removeEventListener("online", apply)
      window.removeEventListener("offline", apply)
    }
  }, [])

  return offline
}

interface GateFlags {
  loading: boolean
  error: boolean
  offline: boolean
  forbidden: boolean
  notFound: boolean
}

interface QueryLike {
  isPending?: boolean
  isLoading?: boolean
  isError?: boolean
  error?: unknown
  data?: unknown
}

function gateFlags(query: QueryLike, offline: boolean): GateFlags {
  const failed = query.isError === true
  const code = failed ? toAppError(query.error).code : null
  const networkError = failed && code === ErrorCode.INTERNAL && offline
  return {
    loading: (query.isPending ?? query.isLoading ?? false) && !failed,
    offline: networkError,
    forbidden: failed && (code === ErrorCode.FORBIDDEN || code === ErrorCode.UNAUTHORIZED),
    notFound: failed && code === ErrorCode.NOT_FOUND,
    error:
      failed &&
      !networkError &&
      code !== ErrorCode.FORBIDDEN &&
      code !== ErrorCode.UNAUTHORIZED &&
      code !== ErrorCode.NOT_FOUND,
  }
}

export function useGate(query: QueryLike): GateFlags {
  const offline = useIsOffline()
  return gateFlags(query, offline)
}

export function fieldErrorsFrom(err: unknown): Record<string, string> {
  const app = toAppError(err)
  return app.code === ErrorCode.VALIDATION ? { ...(app.fields ?? {}) } : {}
}
