"use client"

import { useId } from "react"
import type { ReactNode } from "react"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

export interface FieldRenderProps {
  id: string
  invalid: boolean
  errorId?: string
  describedBy?: string
}

export interface FieldProps {
  label: string
  optional?: boolean
  hint?: string
  error?: string
  counter?: string
  htmlFor?: string
  /**
   * Announce the error as it appears. Forms that render an ErrorSummary pass false: the summary
   * already announces every error, and a second alert per field talks over it.
   */
  announceError?: boolean
  children: ReactNode | ((props: FieldRenderProps) => ReactNode)
  className?: string
}

export function Field({
  label,
  optional,
  hint,
  error,
  counter,
  htmlFor,
  announceError = true,
  children,
  className,
}: FieldProps) {
  const { t } = useT("host-common")
  const generatedId = useId()
  const id = htmlFor ?? generatedId
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const labelId = `${id}-label`
  const describedBy = error ? errorId : hint ? hintId : undefined
  // Plain children with no htmlFor have no control for a <label> to point at (a segmented
  // control, a chip set), so the field becomes a group named by its label instead.
  const grouped = typeof children !== "function" && htmlFor === undefined
  const labelContent = (
    <>
      {label}
      {optional ? (
        <span className="ml-1 font-normal text-console-ink-3">({t("form.optional")})</span>
      ) : null}
    </>
  )
  return (
    <div
      role={grouped ? "group" : undefined}
      aria-labelledby={grouped ? labelId : undefined}
      aria-describedby={grouped ? describedBy : undefined}
      className={cn("flex flex-col gap-token-1", className)}
    >
      {grouped ? (
        <span id={labelId} className="text-token-13 font-semibold text-console-ink-2">
          {labelContent}
        </span>
      ) : (
        <label htmlFor={id} className="text-token-13 font-semibold text-console-ink-2">
          {labelContent}
        </label>
      )}
      {typeof children === "function"
        ? children({
            id,
            invalid: Boolean(error),
            errorId: error ? errorId : undefined,
            describedBy,
          })
        : children}
      <div className="flex items-start gap-token-2">
        <div className="min-w-0 flex-1">
          {error ? (
            <p
              id={errorId}
              role={announceError ? "alert" : undefined}
              className="text-token-12 font-medium text-console-bloom-strong"
            >
              {error}
            </p>
          ) : hint ? (
            <p id={hintId} className="text-token-12 text-console-ink-3">
              {hint}
            </p>
          ) : null}
        </div>
        {counter ? (
          <span className="shrink-0 text-token-12 text-console-ink-3 [font-feature-settings:'tnum']">
            {counter}
          </span>
        ) : null}
      </div>
    </div>
  )
}
