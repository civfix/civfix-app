"use client"

import { CircleAlert, Info, TriangleAlert } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

import { ConsoleButton } from "../button"
import { useEscape, useFocusTrap } from "./use-focus-trap"

export type ConfirmSeverity = "neutral" | "warn" | "danger"

export interface ConfirmPayload {
  reason?: string
}

export interface ConfirmModalProps {
  open: boolean
  severity?: ConfirmSeverity
  title: string
  body?: ReactNode
  banner?: ReactNode
  scopeSummary?: ReactNode
  reasonField?: { label: string; required?: boolean; placeholder?: string }
  agreement?: { label: string }
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: (payload: ConfirmPayload) => void
  onCancel: () => void
  className?: string
}

const SEVERITY_STYLES: Record<ConfirmSeverity, { banner: string; icon: typeof Info }> = {
  neutral: {
    banner: "bg-console-sky-soft text-console-sky-strong border-console-sky-strong/30",
    icon: Info,
  },
  warn: {
    banner: "bg-console-sun-soft text-console-sun-strong border-console-sun-strong/40",
    icon: CircleAlert,
  },
  danger: {
    banner: "bg-console-bloom-soft text-console-bloom-strong border-console-bloom-strong/30",
    icon: TriangleAlert,
  },
}

export function ConfirmModal({
  open,
  severity = "neutral",
  title,
  body,
  banner,
  scopeSummary,
  reasonField,
  agreement,
  confirmLabel,
  cancelLabel,
  busy,
  onConfirm,
  onCancel,
  className,
}: ConfirmModalProps) {
  const { t } = useT("host-common")
  const panelRef = useRef<HTMLDivElement>(null)
  const [reason, setReason] = useState("")
  const [agreed, setAgreed] = useState(false)

  useEscape(open, onCancel)
  useFocusTrap(panelRef, open)

  useEffect(() => {
    if (!open) {
      setReason("")
      setAgreed(false)
    }
  }, [open])

  if (!open || typeof document === "undefined") return null

  const styles = SEVERITY_STYLES[severity]
  const BannerIcon = styles.icon
  const confirmDisabled =
    Boolean(busy) ||
    (agreement ? !agreed : false) ||
    (reasonField?.required ? reason.trim().length === 0 : false)

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-token-4 sm:items-center">
      <div aria-hidden className="absolute inset-0 bg-console-scrim animate-in fade-in duration-d2" />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-md border border-console-line bg-console-surface shadow-console-4",
          "animate-in fade-in zoom-in-95 duration-d2 ease-out",
          className,
        )}
      >
        <div className="flex flex-col gap-token-3 p-token-5">
          <h2 className="font-display text-token-18 font-bold text-console-ink">{title}</h2>
          {banner ? (
            <div
              className={cn(
                "flex items-start gap-token-2 rounded-sm border p-token-3 text-token-13 font-medium",
                styles.banner,
              )}
            >
              <BannerIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">{banner}</div>
            </div>
          ) : null}
          {body ? <div className="text-token-14 text-console-ink-2">{body}</div> : null}
          {scopeSummary ? (
            <div className="rounded-sm border border-console-line bg-console-tint p-token-3 text-token-13 text-console-ink-2">
              {scopeSummary}
            </div>
          ) : null}
          {reasonField ? (
            <label className="flex flex-col gap-token-1">
              <span className="text-token-13 font-semibold text-console-ink-2">
                {reasonField.label}
                {reasonField.required ? null : (
                  <span className="ml-1 font-normal text-console-ink-3">
                    ({t("form.optional")})
                  </span>
                )}
              </span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={reasonField.placeholder}
                rows={2}
                className="w-full rounded-xs border border-console-line bg-console-surface px-token-3 py-token-2 text-token-14 text-console-ink placeholder:text-console-ink-3 focus-visible:outline-none focus-visible:shadow-console-ring"
              />
            </label>
          ) : null}
          {agreement ? (
            <label className="flex cursor-pointer items-start gap-token-2 rounded-sm border border-console-line bg-console-tint p-token-3">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-console-accent"
              />
              <span className="text-token-13 font-medium text-console-ink-2">
                {agreement.label}
              </span>
            </label>
          ) : null}
        </div>
        <footer className="flex items-center justify-end gap-token-2 border-t border-console-line bg-console-tint px-token-5 py-token-3">
          <ConsoleButton variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel ?? t("action.cancel")}
          </ConsoleButton>
          <ConsoleButton
            variant={severity === "danger" ? "destructive" : "primary"}
            size="sm"
            disabled={confirmDisabled}
            onClick={() => onConfirm({ reason: reason.trim() || undefined })}
          >
            {confirmLabel}
          </ConsoleButton>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
