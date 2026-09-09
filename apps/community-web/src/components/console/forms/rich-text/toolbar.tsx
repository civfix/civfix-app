"use client"

import { Bold, Italic, Link as LinkIcon, List, ListOrdered } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

export type RichTextCommand = "bold" | "italic" | "link" | "bullet" | "ordered"

const COMMANDS: readonly { id: RichTextCommand; icon: LucideIcon; labelKey: string; kbd?: string }[] =
  [
    { id: "bold", icon: Bold, labelKey: "editor.bold", kbd: "⌘B" },
    { id: "italic", icon: Italic, labelKey: "editor.italic", kbd: "⌘I" },
    { id: "link", icon: LinkIcon, labelKey: "editor.link", kbd: "⌘K" },
    { id: "bullet", icon: List, labelKey: "editor.bullet_list" },
    { id: "ordered", icon: ListOrdered, labelKey: "editor.ordered_list" },
  ]

export interface RichTextToolbarProps {
  onCommand: (command: RichTextCommand) => void
  disabled?: boolean
  className?: string
}

export function RichTextToolbar({ onCommand, disabled, className }: RichTextToolbarProps) {
  const { t } = useT("host-common")
  return (
    <div
      role="group"
      aria-label={t("editor.toolbar")}
      className={cn(
        "flex items-center gap-0.5 border-b border-console-line bg-console-tint px-token-2 py-token-1",
        className,
      )}
    >
      {COMMANDS.map((command) => {
        const Icon = command.icon
        const label = command.kbd
          ? `${t(command.labelKey)} (${command.kbd})`
          : t(command.labelKey)
        return (
          <button
            key={command.id}
            type="button"
            disabled={disabled}
            aria-label={label}
            title={label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onCommand(command.id)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xs text-console-ink-2 transition-colors duration-d1 hover:bg-console-surface-alt hover:text-console-ink focus-visible:outline-none focus-visible:shadow-console-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon aria-hidden className="h-4 w-4" />
          </button>
        )
      })}
    </div>
  )
}
