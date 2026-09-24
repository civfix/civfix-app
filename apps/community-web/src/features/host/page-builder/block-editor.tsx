"use client"

import type { ComponentType, ReactNode } from "react"
import { Plus, Trash2 } from "lucide-react"
import type { EventPageBlock, EventPageBlockKind } from "@civfix/shared"
import { SAFE_HTTPS_LINK_MAX } from "@civfix/shared"
import { MARKDOWN_SUBSET_MAX_CHARS } from "@civfix/shared/markdown"
import { useT } from "@civfix/ui/i18n"

import { Field } from "@/components/console/forms/field"
import { TextInput, TextArea } from "@/components/console/forms/inputs"
import { ToggleRow } from "@/components/console/forms/toggle-row"
import { RichTextEditor } from "@/components/console/forms/rich-text/editor"
import { ConsoleButton, ConsoleIconButton } from "@/components/console/button"

import { rowKey, withRowKey } from "./blocks"
import type { BlockIssue } from "./blocks"

// The block schema's maxima (EventPageBlockSchema in the shared contract), which the contract does
// not export as constants.
const BLOCK_TITLE_MAX = 160
const HERO_HEADLINE_MAX = 160
const HERO_SUBHEAD_MAX = 320
const BLOCK_TEXT_MAX = 1200
const AGENDA_ITEMS_MAX = 30
const AGENDA_TIME_MAX = 40
const AGENDA_ITEM_TITLE_MAX = 160
const ROW_DESCRIPTION_MAX = 600
const HOST_ENTRIES_MAX = 20
const ENTRY_NAME_MAX = 120
const HOST_ROLE_MAX = 80
const FAQ_ITEMS_MAX = 30
const FAQ_QUESTION_MAX = 200
const SPONSOR_ENTRIES_MAX = 20
const EMAIL_MAX = 254

const LINK_PLACEHOLDER = "https://"

type BlockOf<K extends EventPageBlockKind> = Extract<EventPageBlock, { kind: K }>
type ErrorAt = (path: string) => string | undefined

interface KindEditorProps<K extends EventPageBlockKind> {
  block: BlockOf<K>
  onChange: (patch: Partial<BlockOf<K>>) => void
  errorAt: ErrorAt
}

export interface BlockEditorProps {
  block: EventPageBlock
  onChange: (patch: Partial<EventPageBlock>) => void
  errors?: Readonly<Record<string, BlockIssue>>
}

function BlockFields({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-token-3">{children}</div>
}

interface BlockTextFieldProps {
  id: string
  label: string
  value: string | null | undefined
  maxLength: number
  onChange: (value: string) => void
  multiline?: boolean
  optional?: boolean
  hint?: string
  error?: string
  placeholder?: string
  type?: "email"
}

function BlockTextField({
  id,
  label,
  value,
  maxLength,
  onChange,
  multiline,
  optional,
  hint,
  error,
  placeholder,
  type,
}: BlockTextFieldProps) {
  return (
    <Field label={label} htmlFor={id} optional={optional} hint={hint} error={error}>
      {multiline ? (
        <TextArea
          id={id}
          value={value ?? ""}
          maxLength={maxLength}
          invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <TextInput
          id={id}
          type={type}
          placeholder={placeholder}
          value={value ?? ""}
          maxLength={maxLength}
          invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  )
}

function BlockTitleField({
  block,
  onChange,
}: {
  block: { id: string; title?: string | null }
  onChange: (patch: { title: string }) => void
}) {
  const { t } = useT("host-page-builder")
  return (
    <BlockTextField
      id={`${block.id}-title`}
      label={t("block.title")}
      optional
      value={block.title}
      maxLength={BLOCK_TITLE_MAX}
      onChange={(title) => onChange({ title })}
    />
  )
}

function ListRow({
  label,
  onRemove,
  children,
}: {
  label: string
  onRemove: () => void
  children: ReactNode
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

interface ListFieldSpec<T> {
  key: Extract<keyof T, string>
  label: string
  maxLength: number
  multiline?: boolean
  optional?: boolean
  placeholder?: string
}

interface RecordListEditorProps<T extends object> {
  rows: readonly T[]
  onChange: (rows: T[]) => void
  /** Row input ids are `${idPrefix}-${index}-${field}`. */
  idPrefix: string
  /** The block's list key, which prefixes each row's error path (`items.2.title`). */
  listKey: "items" | "entries"
  errorAt: ErrorAt
  rowLabel: (n: number) => string
  fields: readonly ListFieldSpec<T>[]
  max: number
  blank: T
  addLabel: string
}

function RecordListEditor<T extends object>({
  rows,
  onChange,
  idPrefix,
  listKey,
  errorAt,
  rowLabel,
  fields,
  max,
  blank,
  addLabel,
}: RecordListEditorProps<T>) {
  const setField = (index: number, key: Extract<keyof T, string>, value: string) =>
    onChange(rows.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)))

  return (
    <>
      <ul className="flex flex-col gap-token-2">
        {rows.map((row, index) => (
          <ListRow
            key={rowKey(row)}
            label={rowLabel(index + 1)}
            onRemove={() => onChange(rows.filter((_, i) => i !== index))}
          >
            {fields.map((field) => (
              <BlockTextField
                key={field.key}
                id={`${idPrefix}-${index}-${field.key}`}
                label={field.label}
                multiline={field.multiline}
                optional={field.optional}
                placeholder={field.placeholder}
                value={row[field.key] as string | null | undefined}
                maxLength={field.maxLength}
                error={errorAt(`${listKey}.${index}.${field.key}`)}
                onChange={(value) => setField(index, field.key, value)}
              />
            ))}
          </ListRow>
        ))}
      </ul>
      <ConsoleButton
        variant="outline"
        size="sm"
        disabled={rows.length >= max}
        onClick={() => onChange([...rows, withRowKey(blank)])}
      >
        <Plus aria-hidden className="h-4 w-4" />
        {addLabel}
      </ConsoleButton>
    </>
  )
}

type AgendaItem = BlockOf<"agenda">["items"][number]
type HostEntry = BlockOf<"hosts">["entries"][number]
type FaqItem = BlockOf<"faq">["items"][number]
type SponsorEntry = BlockOf<"sponsors">["entries"][number]

const BLANK_AGENDA_ITEM: AgendaItem = { title: "", time: null, description: null }
const BLANK_HOST_ENTRY: HostEntry = { name: "" }
const BLANK_FAQ_ITEM: FaqItem = { question: "", answer: "" }
const BLANK_SPONSOR_ENTRY: SponsorEntry = { name: "" }

function HeroEditor({ block, onChange }: KindEditorProps<"hero">) {
  const { t } = useT("host-page-builder")
  return (
    <BlockFields>
      <BlockTextField
        id={`${block.id}-headline`}
        label={t("block.hero.headline")}
        optional
        value={block.headline}
        maxLength={HERO_HEADLINE_MAX}
        onChange={(headline) => onChange({ headline })}
      />
      <BlockTextField
        id={`${block.id}-subhead`}
        label={t("block.hero.subhead")}
        optional
        value={block.subhead}
        maxLength={HERO_SUBHEAD_MAX}
        onChange={(subhead) => onChange({ subhead })}
      />
    </BlockFields>
  )
}

function AboutEditor({ block, onChange }: KindEditorProps<"about">) {
  const { t } = useT("host-page-builder")
  return (
    <BlockFields>
      <BlockTitleField block={block} onChange={onChange} />
      <Field label={t("block.about.body")} htmlFor={`${block.id}-body`}>
        <RichTextEditor
          id={`${block.id}-body`}
          value={block.body}
          maxChars={MARKDOWN_SUBSET_MAX_CHARS}
          onChange={(value) => onChange({ body: value })}
        />
      </Field>
    </BlockFields>
  )
}

function AgendaEditor({ block, onChange, errorAt }: KindEditorProps<"agenda">) {
  const { t } = useT("host-page-builder")
  return (
    <BlockFields>
      <BlockTitleField block={block} onChange={onChange} />
      <RecordListEditor
        rows={block.items}
        onChange={(items) => onChange({ items })}
        idPrefix={`${block.id}-item`}
        listKey="items"
        errorAt={errorAt}
        rowLabel={(n) => t("block.agenda.item", { n })}
        fields={[
          {
            key: "time",
            label: t("block.agenda.time"),
            optional: true,
            maxLength: AGENDA_TIME_MAX,
          },
          { key: "title", label: t("block.agenda.item_title"), maxLength: AGENDA_ITEM_TITLE_MAX },
          {
            key: "description",
            label: t("block.agenda.item_description"),
            optional: true,
            multiline: true,
            maxLength: ROW_DESCRIPTION_MAX,
          },
        ]}
        max={AGENDA_ITEMS_MAX}
        blank={BLANK_AGENDA_ITEM}
        addLabel={t("block.agenda.add")}
      />
    </BlockFields>
  )
}

function HostsEditor({ block, onChange, errorAt }: KindEditorProps<"hosts">) {
  const { t } = useT("host-page-builder")
  return (
    <BlockFields>
      <BlockTitleField block={block} onChange={onChange} />
      <RecordListEditor
        rows={block.entries}
        onChange={(entries) => onChange({ entries })}
        idPrefix={`${block.id}-host`}
        listKey="entries"
        errorAt={errorAt}
        rowLabel={(n) => t("block.hosts.entry", { n })}
        fields={[
          { key: "name", label: t("block.hosts.name"), maxLength: ENTRY_NAME_MAX },
          { key: "role", label: t("block.hosts.role"), optional: true, maxLength: HOST_ROLE_MAX },
          {
            key: "bio",
            label: t("block.hosts.bio"),
            optional: true,
            multiline: true,
            maxLength: ROW_DESCRIPTION_MAX,
          },
        ]}
        max={HOST_ENTRIES_MAX}
        blank={BLANK_HOST_ENTRY}
        addLabel={t("block.hosts.add")}
      />
    </BlockFields>
  )
}

function FaqEditor({ block, onChange, errorAt }: KindEditorProps<"faq">) {
  const { t } = useT("host-page-builder")
  return (
    <BlockFields>
      <BlockTitleField block={block} onChange={onChange} />
      <RecordListEditor
        rows={block.items}
        onChange={(items) => onChange({ items })}
        idPrefix={`${block.id}-faq`}
        listKey="items"
        errorAt={errorAt}
        rowLabel={(n) => t("block.faq.item", { n })}
        fields={[
          { key: "question", label: t("block.faq.question"), maxLength: FAQ_QUESTION_MAX },
          {
            key: "answer",
            label: t("block.faq.answer"),
            multiline: true,
            maxLength: BLOCK_TEXT_MAX,
          },
        ]}
        max={FAQ_ITEMS_MAX}
        blank={BLANK_FAQ_ITEM}
        addLabel={t("block.faq.add")}
      />
    </BlockFields>
  )
}

function LocationEditor({ block, onChange }: KindEditorProps<"location">) {
  const { t } = useT("host-page-builder")
  return (
    <BlockFields>
      <BlockTitleField block={block} onChange={onChange} />
      <BlockTextField
        id={`${block.id}-note`}
        label={t("block.location.note")}
        optional
        multiline
        value={block.note}
        maxLength={BLOCK_TEXT_MAX}
        onChange={(note) => onChange({ note })}
      />
      <ToggleRow
        label={t("block.location.show_map")}
        checked={block.showMap}
        onChange={(checked) => onChange({ showMap: checked })}
      />
    </BlockFields>
  )
}

function SponsorsEditor({ block, onChange, errorAt }: KindEditorProps<"sponsors">) {
  const { t } = useT("host-page-builder")
  return (
    <BlockFields>
      <BlockTitleField block={block} onChange={onChange} />
      <RecordListEditor
        rows={block.entries}
        onChange={(entries) => onChange({ entries })}
        idPrefix={`${block.id}-sponsor`}
        listKey="entries"
        errorAt={errorAt}
        rowLabel={(n) => t("block.sponsors.entry", { n })}
        fields={[
          { key: "name", label: t("block.sponsors.name"), maxLength: ENTRY_NAME_MAX },
          {
            key: "url",
            label: t("block.sponsors.url"),
            optional: true,
            placeholder: LINK_PLACEHOLDER,
            maxLength: SAFE_HTTPS_LINK_MAX,
          },
        ]}
        max={SPONSOR_ENTRIES_MAX}
        blank={BLANK_SPONSOR_ENTRY}
        addLabel={t("block.sponsors.add")}
      />
    </BlockFields>
  )
}

function DonateEditor({ block, onChange, errorAt }: KindEditorProps<"donate">) {
  const { t } = useT("host-page-builder")
  return (
    <BlockFields>
      <BlockTitleField block={block} onChange={onChange} />
      <BlockTextField
        id={`${block.id}-blurb`}
        label={t("block.donate.blurb")}
        optional
        multiline
        value={block.blurb}
        maxLength={BLOCK_TEXT_MAX}
        onChange={(blurb) => onChange({ blurb })}
      />
      <BlockTextField
        id={`${block.id}-url`}
        label={t("block.donate.url")}
        optional
        hint={t("block.donate.url_hint")}
        error={errorAt("url")}
        placeholder={LINK_PLACEHOLDER}
        value={block.url}
        maxLength={SAFE_HTTPS_LINK_MAX}
        onChange={(url) => onChange({ url })}
      />
    </BlockFields>
  )
}

function RegistrationEditor({ block, onChange }: KindEditorProps<"registration">) {
  const { t } = useT("host-page-builder")
  return (
    <BlockFields>
      <BlockTitleField block={block} onChange={onChange} />
      <BlockTextField
        id={`${block.id}-note`}
        label={t("block.registration.note")}
        optional
        multiline
        value={block.note}
        maxLength={BLOCK_TEXT_MAX}
        onChange={(note) => onChange({ note })}
      />
    </BlockFields>
  )
}

function ContactEditor({ block, onChange, errorAt }: KindEditorProps<"contact">) {
  const { t } = useT("host-page-builder")
  return (
    <BlockFields>
      <BlockTitleField block={block} onChange={onChange} />
      <BlockTextField
        id={`${block.id}-body`}
        label={t("block.contact.body")}
        optional
        multiline
        value={block.body}
        maxLength={BLOCK_TEXT_MAX}
        onChange={(body) => onChange({ body })}
      />
      <BlockTextField
        id={`${block.id}-reply`}
        label={t("block.contact.reply_to")}
        optional
        hint={t("block.contact.reply_to_hint")}
        error={errorAt("replyTo")}
        type="email"
        value={block.replyTo}
        maxLength={EMAIL_MAX}
        onChange={(replyTo) => onChange({ replyTo })}
      />
    </BlockFields>
  )
}

const KIND_EDITORS: { [K in EventPageBlockKind]: ComponentType<KindEditorProps<K>> } = {
  hero: HeroEditor,
  about: AboutEditor,
  agenda: AgendaEditor,
  hosts: HostsEditor,
  faq: FaqEditor,
  location: LocationEditor,
  sponsors: SponsorsEditor,
  donate: DonateEditor,
  registration: RegistrationEditor,
  contact: ContactEditor,
}

export function BlockEditor({ block, onChange, errors = {} }: BlockEditorProps) {
  const { t } = useT("host-page-builder")
  const errorAt = (path: string): string | undefined => {
    const issue = errors[path]
    return issue ? t(`block.error.${issue}`) : undefined
  }
  const Editor = KIND_EDITORS[block.kind] as ComponentType<KindEditorProps<EventPageBlockKind>>
  return <Editor block={block} onChange={onChange} errorAt={errorAt} />
}
