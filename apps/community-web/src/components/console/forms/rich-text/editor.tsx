"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"
import type { KeyboardEvent } from "react"
import { MARKDOWN_SUBSET_MAX_CHARS } from "@civfix/shared/markdown"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

import { MarkdownPreview } from "./preview"
import { RichTextToolbar } from "./toolbar"
import type { RichTextCommand } from "./toolbar"
import {
  insertLink,
  isInsertableLinkHref,
  toggleBold,
  toggleBulletList,
  toggleItalic,
  toggleOrderedList,
} from "./markdown-commands"
import type { CommandResult, TextSelection } from "./markdown-commands"

export interface RichTextEditorProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  maxChars?: number
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  promptForLink?: (current: string) => string | null
  className?: string
}

export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  rows = 8,
  maxChars = MARKDOWN_SUBSET_MAX_CHARS,
  disabled,
  invalid,
  describedBy,
  promptForLink,
  className,
}: RichTextEditorProps) {
  const { t } = useT("host-common")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelection = useRef<[number, number] | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)

  useLayoutEffect(() => {
    const pending = pendingSelection.current
    const el = textareaRef.current
    if (!pending || !el) return
    pendingSelection.current = null
    el.focus()
    el.setSelectionRange(pending[0], pending[1])
  }, [value])

  const apply = useCallback(
    (result: CommandResult | null) => {
      if (!result) return
      pendingSelection.current = [result.start, result.end]
      onChange(result.value.slice(0, maxChars))
    },
    [maxChars, onChange],
  )

  const selectionOf = useCallback((): TextSelection | null => {
    const el = textareaRef.current
    if (!el) return null
    return { value: el.value, start: el.selectionStart, end: el.selectionEnd }
  }, [])

  const runCommand = useCallback(
    (command: RichTextCommand) => {
      const sel = selectionOf()
      if (!sel || disabled) return
      setLinkError(null)
      switch (command) {
        case "bold":
          apply(toggleBold(sel))
          return
        case "italic":
          apply(toggleItalic(sel))
          return
        case "bullet":
          apply(toggleBulletList(sel))
          return
        case "ordered":
          apply(toggleOrderedList(sel))
          return
        case "link": {
          const ask =
            promptForLink ??
            ((current: string) =>
              typeof window === "undefined" ? null : window.prompt(t("editor.link_prompt"), current))
          const href = ask("https://")
          if (href === null) return
          if (!isInsertableLinkHref(href)) {
            setLinkError(t("editor.link_invalid"))
            return
          }
          apply(insertLink(sel, href))
        }
      }
    },
    [apply, disabled, promptForLink, selectionOf, t],
  )

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return
    const key = event.key.toLowerCase()
    if (key !== "b" && key !== "i" && key !== "k") return
    event.preventDefault()
    runCommand(key === "b" ? "bold" : key === "i" ? "italic" : "link")
  }

  const remaining = maxChars - value.length

  return (
    <div className={cn("flex flex-col gap-token-2", className)}>
      <div
        className={cn(
          "overflow-hidden rounded-xs border bg-console-surface",
          invalid ? "border-console-bloom-strong" : "border-console-line",
        )}
      >
        <RichTextToolbar onCommand={runCommand} disabled={disabled} />
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          rows={rows}
          disabled={disabled}
          maxLength={maxChars}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onKeyDown={onKeyDown}
          onChange={(event) => onChange(event.target.value)}
          className="w-full resize-y bg-console-surface px-token-3 py-token-2 font-mono text-token-13 leading-base text-console-ink placeholder:text-console-ink-3 focus-visible:outline-none focus-visible:shadow-console-ring"
        />
      </div>
      {linkError ? (
        <p role="alert" className="text-token-12 font-medium text-console-bloom-strong">
          {linkError}
        </p>
      ) : null}
      <div className="flex items-baseline justify-between gap-token-2">
        <p className="text-token-12 font-semibold uppercase tracking-wider text-console-ink-3">
          {t("editor.preview")}
        </p>
        <span className="text-token-12 text-console-ink-3 [font-feature-settings:'tnum']">
          {remaining}
        </span>
      </div>
      <div className="rounded-xs border border-console-line bg-console-tint px-token-3 py-token-3">
        {value.trim().length === 0 ? (
          <p className="text-token-13 text-console-ink-3">{t("editor.preview_empty")}</p>
        ) : (
          <MarkdownPreview source={value} maxChars={maxChars} />
        )}
      </div>
    </div>
  )
}
