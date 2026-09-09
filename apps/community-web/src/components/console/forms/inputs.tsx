"use client"

import { ChevronDown, Search } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

export const CONSOLE_INPUT_CLASSES =
  "h-9 w-full rounded-xs border border-console-line bg-console-surface px-token-3 text-token-14 text-console-ink placeholder:text-console-ink-3 transition-shadow duration-d1 focus-visible:outline-none focus-visible:shadow-console-ring disabled:cursor-not-allowed disabled:bg-console-surface-alt disabled:text-console-ink-3"

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  leadingIcon?: "search"
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ invalid, leadingIcon, className, ...props }, ref) => {
    if (leadingIcon === "search") {
      return (
        <span className="relative block w-full">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-token-2 top-1/2 h-4 w-4 -translate-y-1/2 text-console-ink-3"
          />
          <input
            ref={ref}
            className={cn(
              CONSOLE_INPUT_CLASSES,
              "pl-8",
              invalid && "border-console-bloom-strong",
              className,
            )}
            aria-invalid={invalid || undefined}
            {...props}
          />
        </span>
      )
    }
    return (
      <input
        ref={ref}
        className={cn(CONSOLE_INPUT_CLASSES, invalid && "border-console-bloom-strong", className)}
        aria-invalid={invalid || undefined}
        {...props}
      />
    )
  },
)
TextInput.displayName = "TextInput"

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ invalid, className, rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        CONSOLE_INPUT_CLASSES,
        "h-auto py-token-2 leading-base",
        invalid && "border-console-bloom-strong",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  ),
)
TextArea.displayName = "TextArea"

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: readonly SelectOption[]
  placeholder?: string
  invalid?: boolean
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, placeholder, invalid, className, value, defaultValue, ...props }, ref) => (
    <span className="relative block w-full">
      <select
        ref={ref}
        value={value}
        defaultValue={value === undefined ? (defaultValue ?? "") : undefined}
        className={cn(
          CONSOLE_INPUT_CLASSES,
          "appearance-none pr-8",
          invalid && "border-console-bloom-strong",
          className,
        )}
        aria-invalid={invalid || undefined}
        {...props}
      >
        {placeholder !== undefined ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-token-2 top-1/2 h-4 w-4 -translate-y-1/2 text-console-ink-3"
      />
    </span>
  ),
)
Select.displayName = "Select"
