import { createContext, useContext } from "react"

export type ToastVariant = "success" | "error" | "info"

export interface ToastAction {
  label: string
  onPress: () => void
}

export interface ToastOptions {
  variant?: ToastVariant
  durationMs?: number
  action?: ToastAction
}

export interface ToastApi {
  show: (message: string, opts?: ToastOptions) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

const NOOP_TOAST: ToastApi = { show: () => {} }

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NOOP_TOAST
}
