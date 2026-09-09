"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export type ConsoleButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
export type ConsoleButtonSize = "sm" | "md" | "lg" | "icon"

const VARIANT_CLASSES: Record<ConsoleButtonVariant, string> = {
  primary:
    "bg-console-ink text-console-surface shadow-console-1 hover:opacity-90 disabled:hover:opacity-100",
  secondary:
    "bg-console-surface-alt text-console-ink hover:bg-console-tint",
  outline:
    "border border-console-line bg-console-surface text-console-ink hover:bg-console-surface-alt",
  ghost: "text-console-ink-2 hover:bg-console-surface-alt hover:text-console-ink",
  destructive:
    "bg-console-bloom-strong text-console-surface shadow-console-1 hover:opacity-90 disabled:hover:opacity-100",
}

const SIZE_CLASSES: Record<ConsoleButtonSize, string> = {
  sm: "h-8 rounded-sm px-token-3 text-token-13",
  md: "h-10 rounded-sm px-token-4 text-token-14",
  lg: "h-11 rounded-md px-token-5 text-token-14",
  icon: "h-8 w-8 rounded-sm",
}

export interface ConsoleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ConsoleButtonVariant
  size?: ConsoleButtonSize
}

export const ConsoleButton = React.forwardRef<HTMLButtonElement, ConsoleButtonProps>(
  ({ variant = "primary", size = "md", type = "button", className, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition-colors duration-d1 ease-out focus-visible:outline-none focus-visible:shadow-console-ring disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  ),
)
ConsoleButton.displayName = "ConsoleButton"

export interface ConsoleIconButtonProps extends ConsoleButtonProps {
  label: string
}

export const ConsoleIconButton = React.forwardRef<HTMLButtonElement, ConsoleIconButtonProps>(
  ({ label, variant = "ghost", size = "icon", ...props }, ref) => (
    <ConsoleButton ref={ref} aria-label={label} title={label} variant={variant} size={size} {...props} />
  ),
)
ConsoleIconButton.displayName = "ConsoleIconButton"
