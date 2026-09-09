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
  children,
  className,
}: FieldProps) {
  const { t } = useT("host-common")
  const generatedId = useId()
  const id = htmlFor ?? generatedId
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = error ? errorId : hint ? hintId : undefined
  return (
    <div className={cn("flex flex-col gap-token-1", className)}>
      <label htmlFor={id} className="text-token-13 font-semibold text-console-ink-2">
        {label}
        {optional ? (
          <span className="ml-1 font-normal text-console-ink-3">({t("form.optional")})</span>
        ) : null}
      </label>
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
            <p id={errorId} role="alert" className="text-token-12 font-medium text-console-bloom-strong">
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
