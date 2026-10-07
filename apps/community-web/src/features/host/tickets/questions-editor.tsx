"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  EventQuestionCondition,
  EventQuestionDef,
  EventQuestionDTO,
  EventQuestionKind,
  EventQuestionOption,
} from "@civfix/shared"
import {
  MAX_CONSENT_TEXT,
  MAX_EVENT_QUESTIONS,
  MAX_QUESTION_HELP,
  MAX_QUESTION_OPTION_LABEL,
  MAX_QUESTION_OPTION_VALUE,
  MAX_QUESTION_PROMPT,
} from "@civfix/shared"
import { useApi, useEventQuestions } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { useGate } from "@/components/console/query-state"
import { fieldErrorsFrom } from "@/components/console/query-state"
import { LoadingState, StateGate } from "@/components/console/states"
import { ConsoleButton, ConsoleIconButton } from "@/components/console/button"
import { Field } from "@/components/console/forms/field"
import { TextInput, TextArea, Select } from "@/components/console/forms/inputs"
import { ToggleRow } from "@/components/console/forms/toggle-row"
import { useConsoleToast } from "@/components/console/overlay/toast"

import { useConsoleErrors } from "../error-copy"
import { invalidateEvent } from "../console-invalidate"
import { moveItem } from "../list-order"

const KINDS: readonly EventQuestionKind[] = [
  "short_text",
  "long_text",
  "single_select",
  "multi_select",
  "checkbox",
  "consent",
]

export interface DraftQuestion {
  key: string
  id?: string
  kind: EventQuestionKind
  prompt: string
  helpText: string
  required: boolean
  options: string
  /** The saved options: stored answers and other questions' `showIf` refer to these values. */
  savedOptions: readonly EventQuestionOption[]
  consentText: string
  ticketTypeId: string
  showIf: EventQuestionCondition | null
  maxSelections: number | null
}

export function toDraft(question: EventQuestionDTO): DraftQuestion {
  return {
    key: question.id,
    id: question.id,
    kind: question.kind,
    prompt: question.prompt,
    helpText: question.helpText ?? "",
    required: question.required,
    options: question.options.map((option) => option.label).join("\n"),
    savedOptions: question.options,
    consentText: question.consentText ?? "",
    ticketTypeId: question.ticketTypeId ?? "",
    showIf: question.showIf ?? null,
    maxSelections: question.maxSelections ?? null,
  }
}

function uniqueValue(label: string, taken: ReadonlySet<string>): string {
  const base = label.toLowerCase().slice(0, MAX_QUESTION_OPTION_VALUE)
  if (!taken.has(base)) return base
  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`
    const candidate = `${base.slice(0, MAX_QUESTION_OPTION_VALUE - suffix.length)}${suffix}`
    if (!taken.has(candidate)) return candidate
  }
}

/**
 * Keeps each saved option's value: an unchanged label keeps its value wherever it moved, and a
 * line edited in place keeps the value of the option it replaced, so a relabel never orphans stored
 * answers. Only a genuinely new line gets a value derived from its label, deduplicated because the
 * server does not reject two options with the same value.
 */
export function optionList(
  raw: string,
  saved: readonly EventQuestionOption[] = [],
): EventQuestionOption[] {
  const labels = raw
    .split("\n")
    .map((line) => line.trim().slice(0, MAX_QUESTION_OPTION_LABEL))
    .filter((line) => line.length > 0)
  const used = new Set<number>()
  const values: (string | null)[] = labels.map((label) => {
    const index = saved.findIndex((option, i) => !used.has(i) && option.label === label)
    if (index === -1) return null
    used.add(index)
    return saved[index]!.value
  })
  labels.forEach((_, position) => {
    if (values[position] !== null) return
    const replaced = saved[position]
    if (replaced && !used.has(position)) {
      used.add(position)
      values[position] = replaced.value
    }
  })
  const taken = new Set(values.filter((value): value is string => value !== null))
  return labels.map((label, position) => {
    const kept = values[position]
    if (kept !== null && kept !== undefined) return { value: kept, label }
    const value = uniqueValue(label, taken)
    taken.add(value)
    return { value, label }
  })
}

/**
 * With `keptIds`, a condition pointing at a question that is not part of this save is dropped:
 * deleting a question must not leave another one conditional on something that no longer exists.
 */
export function toDef(
  draft: DraftQuestion,
  index: number,
  keptIds?: ReadonlySet<string>,
): EventQuestionDef {
  const showIf =
    draft.showIf && (keptIds === undefined || keptIds.has(draft.showIf.questionId))
      ? draft.showIf
      : null
  const base = {
    ...(draft.id ? { id: draft.id } : {}),
    prompt: draft.prompt.trim(),
    ...(draft.helpText.trim() ? { helpText: draft.helpText.trim() } : {}),
    required: draft.required,
    sortOrder: index,
    ...(draft.ticketTypeId ? { ticketTypeId: draft.ticketTypeId } : {}),
    ...(showIf ? { showIf } : {}),
  }
  switch (draft.kind) {
    case "single_select":
      return {
        ...base,
        kind: "single_select",
        options: optionList(draft.options, draft.savedOptions),
      }
    case "multi_select":
      return {
        ...base,
        kind: "multi_select",
        options: optionList(draft.options, draft.savedOptions),
        ...(draft.maxSelections !== null ? { maxSelections: draft.maxSelections } : {}),
      }
    case "consent":
      return { ...base, kind: "consent", consentText: draft.consentText.trim() }
    case "long_text":
      return { ...base, kind: "long_text" }
    case "checkbox":
      return { ...base, kind: "checkbox" }
    default:
      return { ...base, kind: "short_text" }
  }
}

export function toDefs(drafts: readonly DraftQuestion[]): EventQuestionDef[] {
  const keptIds = new Set(drafts.flatMap((draft) => (draft.id ? [draft.id] : [])))
  return drafts.map((draft, index) => toDef(draft, index, keptIds))
}

export function questionDraftsDiffer(
  drafts: readonly DraftQuestion[],
  questions: readonly EventQuestionDTO[],
): boolean {
  return JSON.stringify(toDefs(drafts)) !== JSON.stringify(toDefs(questions.map(toDraft)))
}

let counter = 0

function newKey(): string {
  counter += 1
  return `q-${counter}`
}

export function QuestionsEditor({
  eventId,
  ticketTypes,
}: {
  eventId: string
  ticketTypes: readonly { id: string; name: string }[]
}) {
  const { t } = useT("host-tickets")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()

  const questions = useEventQuestions(eventId)
  const gate = useGate(questions)
  const [drafts, setDrafts] = useState<DraftQuestion[] | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [seededFrom, setSeededFrom] = useState<EventQuestionDTO[] | null>(null)

  // A refetch reseeds the drafts only while they still match the list they were seeded from, so a
  // server change shows up without ever overwriting the host's unsaved edits.
  if (questions.data && questions.data !== seededFrom) {
    setSeededFrom(questions.data)
    if (drafts === null || seededFrom === null || !questionDraftsDiffer(drafts, seededFrom)) {
      setDrafts(questions.data.map(toDraft))
    }
  }

  const list = drafts ?? []

  const save = useMutation({
    mutationFn: () =>
      api.saveEventQuestions({
        id: eventId,
        questions: toDefs(list),
      }),
    onSuccess: (res) => {
      toast.toast({ title: t("questions.saved"), tone: "success" })
      setDrafts(res.items.map(toDraft))
      setFormError(null)
      invalidateEvent(qc, eventId)
    },
    onError: (err) => {
      const fields = fieldErrorsFrom(err)
      setFormError(fields.questions ?? fields.showIf ?? null)
      toast.toast({ title: errors.message(err), tone: "danger" })
    },
  })

  const update = (key: string, patch: Partial<DraftQuestion>) =>
    setDrafts((prev) =>
      (prev ?? []).map((item) => (item.key === key ? { ...item, ...patch } : item)),
    )

  const questionName = (draft: DraftQuestion, index: number) =>
    draft.prompt.trim() || t("questions.untitled", { n: index + 1 })

  const move = (index: number, delta: number) =>
    setDrafts((prev) => moveItem(prev ?? [], index, delta))

  return (
    <section
      aria-labelledby="questions-heading"
      className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1"
    >
      <div className="mb-token-3 flex flex-wrap items-center justify-between gap-token-2">
        <div>
          <h2
            id="questions-heading"
            className="font-display text-token-16 font-bold text-console-ink"
          >
            {t("questions.title")}
          </h2>
          <p className="text-token-12 text-console-ink-3">{t("questions.hint")}</p>
        </div>
        <div className="flex items-center gap-token-2">
          <ConsoleButton
            variant="outline"
            size="sm"
            disabled={list.length >= MAX_EVENT_QUESTIONS}
            onClick={() =>
              setDrafts((prev) => [
                ...(prev ?? []),
                {
                  key: newKey(),
                  kind: "short_text",
                  prompt: "",
                  helpText: "",
                  required: false,
                  options: "",
                  savedOptions: [],
                  consentText: "",
                  ticketTypeId: "",
                  showIf: null,
                  maxSelections: null,
                },
              ])
            }
          >
            <Plus aria-hidden className="h-4 w-4" />
            {t("questions.add")}
          </ConsoleButton>
          <ConsoleButton size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
            {tc("action.save")}
          </ConsoleButton>
        </div>
      </div>

      {formError ? (
        <p role="alert" className="mb-token-3 text-token-13 font-medium text-console-bloom-strong">
          {formError}
        </p>
      ) : null}

      <p className="mb-token-3 text-token-12 text-console-ink-3">{t("questions.archive_note")}</p>

      <StateGate {...gate} onRetry={() => void questions.refetch()} skeleton={<LoadingState count={3} />}>
        {list.length === 0 ? (
          <p className="text-token-13 text-console-ink-3">{t("questions.empty")}</p>
        ) : (
          <ol className="flex flex-col gap-token-4">
            {list.map((draft, index) => (
              <li
                key={draft.key}
                className="rounded-sm border border-console-line bg-console-tint p-token-3"
              >
                <div className="mb-token-2 flex items-center gap-token-2">
                  <span className="text-token-12 font-bold text-console-ink-3">{index + 1}</span>
                  <span className="min-w-0 flex-1" />
                  <ConsoleIconButton
                    label={t("questions.move_up_named", { name: questionName(draft, index) })}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp aria-hidden className="h-4 w-4" />
                  </ConsoleIconButton>
                  <ConsoleIconButton
                    label={t("questions.move_down_named", { name: questionName(draft, index) })}
                    disabled={index === list.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown aria-hidden className="h-4 w-4" />
                  </ConsoleIconButton>
                  <ConsoleIconButton
                    label={t("questions.remove_named", { name: questionName(draft, index) })}
                    onClick={() =>
                      setDrafts((prev) => (prev ?? []).filter((item) => item.key !== draft.key))
                    }
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </ConsoleIconButton>
                </div>

                <div className="grid gap-token-3 sm:grid-cols-2">
                  <Field label={t("questions.prompt")} htmlFor={`q-prompt-${draft.key}`}>
                    <TextInput
                      id={`q-prompt-${draft.key}`}
                      value={draft.prompt}
                      maxLength={MAX_QUESTION_PROMPT}
                      onChange={(event) => update(draft.key, { prompt: event.target.value })}
                    />
                  </Field>
                  <Field label={t("questions.kind")} htmlFor={`q-kind-${draft.key}`}>
                    <Select
                      id={`q-kind-${draft.key}`}
                      value={draft.kind}
                      onChange={(event) =>
                        update(draft.key, { kind: event.target.value as EventQuestionKind })
                      }
                      options={KINDS.map((kind) => ({
                        value: kind,
                        label: t(`questions.kind_${kind}`),
                      }))}
                    />
                  </Field>
                </div>

                {draft.kind === "single_select" || draft.kind === "multi_select" ? (
                  <Field
                    label={t("questions.options")}
                    htmlFor={`q-options-${draft.key}`}
                    hint={t("questions.options_hint")}
                    className="mt-token-3"
                  >
                    <TextArea
                      id={`q-options-${draft.key}`}
                      value={draft.options}
                      rows={4}
                      onChange={(event) => update(draft.key, { options: event.target.value })}
                    />
                  </Field>
                ) : null}

                {draft.kind === "consent" ? (
                  <Field
                    label={t("questions.consent_text")}
                    htmlFor={`q-consent-${draft.key}`}
                    className="mt-token-3"
                  >
                    <TextArea
                      id={`q-consent-${draft.key}`}
                      value={draft.consentText}
                      rows={3}
                      maxLength={MAX_CONSENT_TEXT}
                      onChange={(event) => update(draft.key, { consentText: event.target.value })}
                    />
                  </Field>
                ) : null}

                <Field
                  label={t("questions.help")}
                  htmlFor={`q-help-${draft.key}`}
                  optional
                  className="mt-token-3"
                >
                  <TextInput
                    id={`q-help-${draft.key}`}
                    value={draft.helpText}
                    maxLength={MAX_QUESTION_HELP}
                    onChange={(event) => update(draft.key, { helpText: event.target.value })}
                  />
                </Field>

                {ticketTypes.length > 0 ? (
                  <Field
                    label={t("questions.ticket_scope")}
                    htmlFor={`q-scope-${draft.key}`}
                    optional
                    hint={t("questions.ticket_scope_hint")}
                    className="mt-token-3"
                  >
                    <Select
                      id={`q-scope-${draft.key}`}
                      value={draft.ticketTypeId}
                      placeholder={t("questions.ticket_all")}
                      onChange={(event) => update(draft.key, { ticketTypeId: event.target.value })}
                      options={ticketTypes.map((type) => ({
                        value: type.id,
                        label: type.name,
                      }))}
                    />
                  </Field>
                ) : null}

                <ToggleRow
                  className="mt-token-2"
                  label={t("questions.required")}
                  checked={draft.required}
                  onChange={(checked) => update(draft.key, { required: checked })}
                />
              </li>
            ))}
          </ol>
        )}
      </StateGate>
    </section>
  )
}
