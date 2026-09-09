"use client"

import { CircleAlert } from "lucide-react"
import { useEffect, useRef } from "react"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

export interface FieldError {
  id: string
  message: string
}

export interface ErrorSummaryProps {
  errors: readonly FieldError[]
  title?: string
  submitCount?: number
  className?: string
}

export function ErrorSummary({ errors, title, submitCount, className }: ErrorSummaryProps) {
  const { t } = useT("host-common")
  const headingRef = useRef<HTMLParagraphElement>(null)
  const hadErrors = useRef(false)
  const lastSubmit = useRef(submitCount)

  useEffect(() => {
    const hasErrors = errors.length > 0
    const submitAdvanced = submitCount !== undefined && submitCount !== lastSubmit.current
    if (hasErrors && (submitAdvanced || !hadErrors.current)) headingRef.current?.focus()
    hadErrors.current = hasErrors
    lastSubmit.current = submitCount
  }, [errors, submitCount])

  if (errors.length === 0) return null

  const focusField = (id: string) => {
    const field = document.getElementById(id)
    if (field) {
      field.focus()
      field.scrollIntoView({ block: "center", behavior: "smooth" })
    }
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-token-2 rounded-sm border border-console-bloom-strong/40 bg-console-bloom-soft px-token-4 py-token-3",
        className,
      )}
    >
      <p
        ref={headingRef}
        tabIndex={-1}
        className="flex items-center gap-token-2 text-token-14 font-bold text-console-bloom-strong focus-visible:outline-none focus-visible:shadow-console-ring"
      >
        <CircleAlert aria-hidden className="h-4 w-4 shrink-0" />
        {title ?? t("form.error_summary_title")}
      </p>
      <ul className="flex flex-col gap-token-1">
        {errors.map((error) => (
          <li key={error.id}>
            <button
              type="button"
              onClick={() => focusField(error.id)}
              className="text-left text-token-13 font-medium text-console-bloom-strong underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-console-ring"
            >
              {error.message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
