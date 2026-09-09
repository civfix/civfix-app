"use client"

import { History } from "lucide-react"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

export interface DraftRestoredBarProps {
  message?: string
  discardLabel?: string
  onDiscard: () => void
  className?: string
}

export function DraftRestoredBar({
  message,
  discardLabel,
  onDiscard,
  className,
}: DraftRestoredBarProps) {
  const { t } = useT("host-common")
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-token-2 rounded-sm border border-console-sky-strong/40 bg-console-sky-soft px-token-3 py-token-2 text-token-13 text-console-sky-strong",
        className,
      )}
    >
      <History aria-hidden className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{message ?? t("form.draft_restored")}</span>
      <button
        type="button"
        onClick={onDiscard}
        className="shrink-0 rounded-xs font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-console-ring"
      >
        {discardLabel ?? t("form.draft_discard")}
      </button>
    </div>
  )
}
