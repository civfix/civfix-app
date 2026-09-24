"use client"

import { ChevronRight, CircleAlert, X } from "lucide-react"
import { useId, useRef } from "react"
import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

import { ConsoleButton, ConsoleIconButton } from "../button"
import { Scrim } from "./scrim"
import { useEscape, useFocusTrap } from "./use-focus-trap"

export interface GuidedSheetSection {
  id: string
  title: string
  content: ReactNode
}

export interface GuidedSheetBlocker {
  id: string
  label: string
  onPress?: () => void
}

export interface GuidedSheetProps {
  open: boolean
  onClose: () => void
  title: string
  progressLabel?: string
  sections?: readonly GuidedSheetSection[]
  blockers?: readonly GuidedSheetBlocker[]
  primaryLabel: string
  onPrimary: () => void
  primaryDisabled?: boolean
  secondary?: ReactNode
  notice?: ReactNode
  children?: ReactNode
  className?: string
}

export function GuidedSheet({
  open,
  onClose,
  title,
  progressLabel,
  sections,
  blockers,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  secondary,
  notice,
  children,
  className,
}: GuidedSheetProps) {
  const { t } = useT("host-common")
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEscape(open, onClose)
  useFocusTrap(panelRef, open)

  if (!open || typeof document === "undefined") return null

  const blocked = (blockers?.length ?? 0) > 0

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-token-4">
      <Scrim />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex max-h-[85vh] w-full flex-col rounded-t-md border border-b-0 border-console-line bg-console-surface shadow-console-4 sm:max-w-lg sm:rounded-md sm:border-b",
          "animate-in slide-in-from-bottom duration-d3 ease-out",
          className,
        )}
      >
        <header className="flex shrink-0 items-center gap-token-2 border-b border-console-line px-token-4 py-token-3">
          <h3
            id={titleId}
            className="min-w-0 flex-1 truncate font-display text-token-15 font-bold text-console-ink">
            {title}
          </h3>
          {progressLabel ? (
            <span className="shrink-0 text-token-12 font-semibold text-console-ink-3 [font-feature-settings:'tnum']">
              {progressLabel}
            </span>
          ) : null}
          <ConsoleIconButton label={t("action.close")} onClick={onClose}>
            <X aria-hidden className="h-4 w-4" />
          </ConsoleIconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-token-4 py-token-3">
          {notice ? <div className="mb-token-3">{notice}</div> : null}
          {blocked ? (
            <section className="mb-token-3 rounded-sm border border-console-sun-strong/40 bg-console-sun-soft p-token-3">
              <h4 className="mb-token-2 flex items-center gap-1.5 text-token-13 font-bold text-console-sun-strong">
                <CircleAlert aria-hidden className="h-4 w-4" />
                {t("guided.blockers")}
              </h4>
              <ul className="flex flex-col gap-token-1">
                {blockers?.map((blocker) => (
                  <li
                    key={blocker.id}
                    className="flex items-center gap-token-2 text-token-13 text-console-ink-2"
                  >
                    <span className="min-w-0 flex-1">{blocker.label}</span>
                    {blocker.onPress ? (
                      <button
                        type="button"
                        onClick={blocker.onPress}
                        className="inline-flex shrink-0 items-center gap-0.5 rounded-xs text-token-12 font-semibold text-console-sky-strong hover:underline focus-visible:outline-none focus-visible:shadow-console-ring"
                      >
                        {t("guided.fix")}
                        <ChevronRight aria-hidden className="h-3 w-3" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {sections?.map((section, index) => (
            <section
              key={section.id}
              className="border-b border-console-line py-token-3 first:pt-0 last:border-b-0"
            >
              <h4 className="mb-token-2 flex items-center gap-token-2 text-token-13 font-bold text-console-ink">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-pill bg-console-surface-alt text-token-12 text-console-ink-3 [font-feature-settings:'tnum']">
                  {index + 1}
                </span>
                {section.title}
              </h4>
              <div className="text-token-13 text-console-ink-2">{section.content}</div>
            </section>
          ))}
          {children}
        </div>
        <footer className="flex shrink-0 items-center justify-end gap-token-2 border-t border-console-line bg-console-tint px-token-4 py-token-3">
          {secondary}
          <ConsoleButton onClick={onPrimary} disabled={primaryDisabled || blocked} size="sm">
            {primaryLabel}
          </ConsoleButton>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
