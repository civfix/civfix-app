"use client"

import { Plus, Trash2 } from "lucide-react"
import type { EventPageBlock } from "@civfix/shared"
import { useT } from "@civfix/ui/i18n"

import { Field } from "@/components/console/forms/field"
import { TextInput, TextArea } from "@/components/console/forms/inputs"
import { ToggleRow } from "@/components/console/forms/toggle-row"
import { RichTextEditor } from "@/components/console/forms/rich-text/editor"
import { ConsoleButton, ConsoleIconButton } from "@/components/console/button"

import { rowKey, withRowKey } from "./blocks"
import type { BlockIssue } from "./blocks"

export interface BlockEditorProps {
  block: EventPageBlock
  onChange: (patch: Partial<EventPageBlock>) => void
  errors?: Readonly<Record<string, BlockIssue>>
}

function ListRow({
  label,
  onRemove,
  children,
}: {
  label: string
  onRemove: () => void
  children: React.ReactNode
}) {
  const { t } = useT("host-page-builder")
  return (
    <li className="rounded-sm border border-console-line bg-console-surface p-token-3">
      <div className="mb-token-2 flex items-center justify-between gap-token-2">
        <span className="text-token-12 font-bold uppercase tracking-wider text-console-ink-3">
          {label}
        </span>
        <ConsoleIconButton label={t("block.remove_row", { label })} onClick={onRemove}>
          <Trash2 aria-hidden className="h-4 w-4" />
        </ConsoleIconButton>
      </div>
      <div className="flex flex-col gap-token-2">{children}</div>
    </li>
  )
}

export function BlockEditor({ block, onChange, errors = {} }: BlockEditorProps) {
  const { t } = useT("host-page-builder")
  const errorAt = (path: string): string | undefined => {
    const issue = errors[path]
    return issue ? t(`block.error.${issue}`) : undefined
  }

  switch (block.kind) {
    case "hero":
      return (
        <div className="flex flex-col gap-token-3">
          <Field label={t("block.hero.headline")} htmlFor={`${block.id}-headline`} optional>
            <TextInput
              id={`${block.id}-headline`}
              value={block.headline ?? ""}
              maxLength={160}
              onChange={(event) => onChange({ headline: event.target.value })}
            />
          </Field>
          <Field label={t("block.hero.subhead")} htmlFor={`${block.id}-subhead`} optional>
            <TextInput
              id={`${block.id}-subhead`}
              value={block.subhead ?? ""}
              maxLength={320}
              onChange={(event) => onChange({ subhead: event.target.value })}
            />
          </Field>
        </div>
      )

    case "about":
      return (
        <div className="flex flex-col gap-token-3">
          <Field label={t("block.title")} htmlFor={`${block.id}-title`} optional>
            <TextInput
              id={`${block.id}-title`}
              value={block.title ?? ""}
              maxLength={160}
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </Field>
          <Field label={t("block.about.body")} htmlFor={`${block.id}-body`}>
            <RichTextEditor
              id={`${block.id}-body`}
              value={block.body}
              maxChars={8000}
              onChange={(value) => onChange({ body: value })}
            />
          </Field>
        </div>
      )

    case "agenda":
      return (
        <div className="flex flex-col gap-token-3">
          <Field label={t("block.title")} htmlFor={`${block.id}-title`} optional>
            <TextInput
              id={`${block.id}-title`}
              value={block.title ?? ""}
              maxLength={160}
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </Field>
          <ul className="flex flex-col gap-token-2">
            {block.items.map((item, index) => (
              <ListRow
                key={rowKey(item)}
                label={t("block.agenda.item", { n: index + 1 })}
                onRemove={() =>
                  onChange({ items: block.items.filter((_, i) => i !== index) })
                }
              >
                <Field
                  label={t("block.agenda.time")}
                  htmlFor={`${block.id}-item-${index}-time`}
                  optional
                  error={errorAt(`items.${index}.time`)}
                >
                  <TextInput
                    id={`${block.id}-item-${index}-time`}
                    value={item.time ?? ""}
                    maxLength={40}
                    invalid={Boolean(errorAt(`items.${index}.time`))}
                    onChange={(event) =>
                      onChange({
                        items: block.items.map((entry, i) =>
                          i === index ? { ...entry, time: event.target.value } : entry,
                        ),
                      })
                    }
                  />
                </Field>
                <Field
                  label={t("block.agenda.item_title")}
                  htmlFor={`${block.id}-item-${index}-title`}
                  error={errorAt(`items.${index}.title`)}
                >
                  <TextInput
                    id={`${block.id}-item-${index}-title`}
                    value={item.title}
                    maxLength={160}
                    invalid={Boolean(errorAt(`items.${index}.title`))}
                    onChange={(event) =>
                      onChange({
                        items: block.items.map((entry, i) =>
                          i === index ? { ...entry, title: event.target.value } : entry,
                        ),
                      })
                    }
                  />
                </Field>
                <Field
                  label={t("block.agenda.item_description")}
                  htmlFor={`${block.id}-item-${index}-description`}
                  optional
                  error={errorAt(`items.${index}.description`)}
                >
                  <TextArea
                    id={`${block.id}-item-${index}-description`}
                    value={item.description ?? ""}
                    maxLength={600}
                    invalid={Boolean(errorAt(`items.${index}.description`))}
                    onChange={(event) =>
                      onChange({
                        items: block.items.map((entry, i) =>
                          i === index ? { ...entry, description: event.target.value } : entry,
                        ),
                      })
                    }
                  />
                </Field>
              </ListRow>
            ))}
          </ul>
          <ConsoleButton
            variant="outline"
            size="sm"
            disabled={block.items.length >= 30}
            onClick={() =>
              onChange({
                items: [...block.items, withRowKey({ title: "", time: null, description: null })],
              })
            }
          >
            <Plus aria-hidden className="h-4 w-4" />
            {t("block.agenda.add")}
          </ConsoleButton>
        </div>
      )

    case "hosts":
      return (
        <div className="flex flex-col gap-token-3">
          <Field label={t("block.title")} htmlFor={`${block.id}-title`} optional>
            <TextInput
              id={`${block.id}-title`}
              value={block.title ?? ""}
              maxLength={160}
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </Field>
          <ul className="flex flex-col gap-token-2">
            {block.entries.map((entry, index) => (
              <ListRow
                key={rowKey(entry)}
                label={t("block.hosts.entry", { n: index + 1 })}
                onRemove={() =>
                  onChange({ entries: block.entries.filter((_, i) => i !== index) })
                }
              >
                <Field
                  label={t("block.hosts.name")}
                  htmlFor={`${block.id}-host-${index}-name`}
                  error={errorAt(`entries.${index}.name`)}
                >
                  <TextInput
                    id={`${block.id}-host-${index}-name`}
                    value={entry.name}
                    maxLength={120}
                    invalid={Boolean(errorAt(`entries.${index}.name`))}
                    onChange={(event) =>
                      onChange({
                        entries: block.entries.map((item, i) =>
                          i === index ? { ...item, name: event.target.value } : item,
                        ),
                      })
                    }
                  />
                </Field>
                <Field
                  label={t("block.hosts.role")}
                  htmlFor={`${block.id}-host-${index}-role`}
                  optional
                  error={errorAt(`entries.${index}.role`)}
                >
                  <TextInput
                    id={`${block.id}-host-${index}-role`}
                    value={entry.role ?? ""}
                    maxLength={80}
                    invalid={Boolean(errorAt(`entries.${index}.role`))}
                    onChange={(event) =>
                      onChange({
                        entries: block.entries.map((item, i) =>
                          i === index ? { ...item, role: event.target.value } : item,
                        ),
                      })
                    }
                  />
                </Field>
                <Field
                  label={t("block.hosts.bio")}
                  htmlFor={`${block.id}-host-${index}-bio`}
                  optional
                  error={errorAt(`entries.${index}.bio`)}
                >
                  <TextArea
                    id={`${block.id}-host-${index}-bio`}
                    value={entry.bio ?? ""}
                    maxLength={600}
                    invalid={Boolean(errorAt(`entries.${index}.bio`))}
                    onChange={(event) =>
                      onChange({
                        entries: block.entries.map((item, i) =>
                          i === index ? { ...item, bio: event.target.value } : item,
                        ),
                      })
                    }
                  />
                </Field>
              </ListRow>
            ))}
          </ul>
          <ConsoleButton
            variant="outline"
            size="sm"
            disabled={block.entries.length >= 20}
            onClick={() => onChange({ entries: [...block.entries, withRowKey({ name: "" })] })}
          >
            <Plus aria-hidden className="h-4 w-4" />
            {t("block.hosts.add")}
          </ConsoleButton>
        </div>
      )

    case "faq":
      return (
        <div className="flex flex-col gap-token-3">
          <Field label={t("block.title")} htmlFor={`${block.id}-title`} optional>
            <TextInput
              id={`${block.id}-title`}
              value={block.title ?? ""}
              maxLength={160}
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </Field>
          <ul className="flex flex-col gap-token-2">
            {block.items.map((item, index) => (
              <ListRow
                key={rowKey(item)}
                label={t("block.faq.item", { n: index + 1 })}
                onRemove={() => onChange({ items: block.items.filter((_, i) => i !== index) })}
              >
                <Field
                  label={t("block.faq.question")}
                  htmlFor={`${block.id}-faq-${index}-question`}
                  error={errorAt(`items.${index}.question`)}
                >
                  <TextInput
                    id={`${block.id}-faq-${index}-question`}
                    value={item.question}
                    maxLength={200}
                    invalid={Boolean(errorAt(`items.${index}.question`))}
                    onChange={(event) =>
                      onChange({
                        items: block.items.map((entry, i) =>
                          i === index ? { ...entry, question: event.target.value } : entry,
                        ),
                      })
                    }
                  />
                </Field>
                <Field
                  label={t("block.faq.answer")}
                  htmlFor={`${block.id}-faq-${index}-answer`}
                  error={errorAt(`items.${index}.answer`)}
                >
                  <TextArea
                    id={`${block.id}-faq-${index}-answer`}
                    value={item.answer}
                    maxLength={1200}
                    invalid={Boolean(errorAt(`items.${index}.answer`))}
                    onChange={(event) =>
                      onChange({
                        items: block.items.map((entry, i) =>
                          i === index ? { ...entry, answer: event.target.value } : entry,
                        ),
                      })
                    }
                  />
                </Field>
              </ListRow>
            ))}
          </ul>
          <ConsoleButton
            variant="outline"
            size="sm"
            disabled={block.items.length >= 30}
            onClick={() =>
              onChange({ items: [...block.items, withRowKey({ question: "", answer: "" })] })
            }
          >
            <Plus aria-hidden className="h-4 w-4" />
            {t("block.faq.add")}
          </ConsoleButton>
        </div>
      )

    case "location":
      return (
        <div className="flex flex-col gap-token-3">
          <Field label={t("block.title")} htmlFor={`${block.id}-title`} optional>
            <TextInput
              id={`${block.id}-title`}
              value={block.title ?? ""}
              maxLength={160}
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </Field>
          <Field label={t("block.location.note")} htmlFor={`${block.id}-note`} optional>
            <TextArea
              id={`${block.id}-note`}
              value={block.note ?? ""}
              maxLength={1200}
              onChange={(event) => onChange({ note: event.target.value })}
            />
          </Field>
          <ToggleRow
            label={t("block.location.show_map")}
            checked={block.showMap}
            onChange={(checked) => onChange({ showMap: checked })}
          />
        </div>
      )

    case "sponsors":
      return (
        <div className="flex flex-col gap-token-3">
          <Field label={t("block.title")} htmlFor={`${block.id}-title`} optional>
            <TextInput
              id={`${block.id}-title`}
              value={block.title ?? ""}
              maxLength={160}
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </Field>
          <ul className="flex flex-col gap-token-2">
            {block.entries.map((entry, index) => (
              <ListRow
                key={rowKey(entry)}
                label={t("block.sponsors.entry", { n: index + 1 })}
                onRemove={() =>
                  onChange({ entries: block.entries.filter((_, i) => i !== index) })
                }
              >
                <Field
                  label={t("block.sponsors.name")}
                  htmlFor={`${block.id}-sponsor-${index}-name`}
                  error={errorAt(`entries.${index}.name`)}
                >
                  <TextInput
                    id={`${block.id}-sponsor-${index}-name`}
                    value={entry.name}
                    maxLength={120}
                    invalid={Boolean(errorAt(`entries.${index}.name`))}
                    onChange={(event) =>
                      onChange({
                        entries: block.entries.map((item, i) =>
                          i === index ? { ...item, name: event.target.value } : item,
                        ),
                      })
                    }
                  />
                </Field>
                <Field
                  label={t("block.sponsors.url")}
                  htmlFor={`${block.id}-sponsor-${index}-url`}
                  optional
                  error={errorAt(`entries.${index}.url`)}
                >
                  <TextInput
                    id={`${block.id}-sponsor-${index}-url`}
                    placeholder="https://"
                    value={entry.url ?? ""}
                    maxLength={500}
                    invalid={Boolean(errorAt(`entries.${index}.url`))}
                    onChange={(event) =>
                      onChange({
                        entries: block.entries.map((item, i) =>
                          i === index ? { ...item, url: event.target.value } : item,
                        ),
                      })
                    }
                  />
                </Field>
              </ListRow>
            ))}
          </ul>
          <ConsoleButton
            variant="outline"
            size="sm"
            disabled={block.entries.length >= 20}
            onClick={() => onChange({ entries: [...block.entries, withRowKey({ name: "" })] })}
          >
            <Plus aria-hidden className="h-4 w-4" />
            {t("block.sponsors.add")}
          </ConsoleButton>
        </div>
      )

    case "donate":
      return (
        <div className="flex flex-col gap-token-3">
          <Field label={t("block.title")} htmlFor={`${block.id}-title`} optional>
            <TextInput
              id={`${block.id}-title`}
              value={block.title ?? ""}
              maxLength={160}
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </Field>
          <Field label={t("block.donate.blurb")} htmlFor={`${block.id}-blurb`} optional>
            <TextArea
              id={`${block.id}-blurb`}
              value={block.blurb ?? ""}
              maxLength={1200}
              onChange={(event) => onChange({ blurb: event.target.value })}
            />
          </Field>
          <Field
            label={t("block.donate.url")}
            htmlFor={`${block.id}-url`}
            optional
            hint={t("block.donate.url_hint")}
            error={errorAt("url")}
          >
            <TextInput
              id={`${block.id}-url`}
              invalid={Boolean(errorAt("url"))}
              value={block.url ?? ""}
              placeholder="https://"
              maxLength={500}
              onChange={(event) => onChange({ url: event.target.value })}
            />
          </Field>
        </div>
      )

    case "registration":
      return (
        <div className="flex flex-col gap-token-3">
          <Field label={t("block.title")} htmlFor={`${block.id}-title`} optional>
            <TextInput
              id={`${block.id}-title`}
              value={block.title ?? ""}
              maxLength={160}
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </Field>
          <Field label={t("block.registration.note")} htmlFor={`${block.id}-note`} optional>
            <TextArea
              id={`${block.id}-note`}
              value={block.note ?? ""}
              maxLength={1200}
              onChange={(event) => onChange({ note: event.target.value })}
            />
          </Field>
        </div>
      )

    case "contact":
      return (
        <div className="flex flex-col gap-token-3">
          <Field label={t("block.title")} htmlFor={`${block.id}-title`} optional>
            <TextInput
              id={`${block.id}-title`}
              value={block.title ?? ""}
              maxLength={160}
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </Field>
          <Field label={t("block.contact.body")} htmlFor={`${block.id}-body`} optional>
            <TextArea
              id={`${block.id}-body`}
              value={block.body ?? ""}
              maxLength={1200}
              onChange={(event) => onChange({ body: event.target.value })}
            />
          </Field>
          <Field
            label={t("block.contact.reply_to")}
            htmlFor={`${block.id}-reply`}
            optional
            hint={t("block.contact.reply_to_hint")}
            error={errorAt("replyTo")}
          >
            <TextInput
              id={`${block.id}-reply`}
              invalid={Boolean(errorAt("replyTo"))}
              type="email"
              value={block.replyTo ?? ""}
              maxLength={254}
              onChange={(event) => onChange({ replyTo: event.target.value })}
            />
          </Field>
        </div>
      )
  }
}
