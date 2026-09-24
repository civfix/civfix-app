"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  CheckEventPageSlugResponse,
  EventPageBlock,
  EventPageBlockKind,
  EventPageDTO,
  ThemeAccent,
} from "@civfix/shared"
import { MAX_EVENT_PAGE_BLOCKS, PAGE_SLUG_MAX, PageSlugSchema } from "@civfix/shared"
import { useApi } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { useGate, fieldErrorsFrom } from "@/components/console/query-state"
import { LoadingState, StateGate } from "@/components/console/states"
import { ConsoleButton, ConsoleIconButton } from "@/components/console/button"
import { Chip } from "@/components/console/chips/chip"
import { Field } from "@/components/console/forms/field"
import { TextInput } from "@/components/console/forms/inputs"
import { SegmentedControl } from "@/components/console/forms/segmented-control"
import { CoverField } from "@/components/console/forms/image-upload"
import type { ConsoleImage } from "@/components/console/forms/image-upload"
import { ToggleRow } from "@/components/console/forms/toggle-row"
import { useConsoleToast } from "@/components/console/overlay/toast"
import { ConfirmModal } from "@/components/console/overlay/confirm-modal"

import { useConsoleEvent } from "../console-context"
import { useConsoleErrors } from "../error-copy"
import { consoleKeys } from "../console-keys"
import {
  BLOCK_KINDS,
  THEME_ACCENTS,
  blockSaveErrors,
  blocksDiffer,
  canAddBlock,
  emptyBlock,
  normalizeBlocksForSave,
  replaceBlock,
  withRowKeys,
} from "./blocks"
import { BlockEditor } from "./block-editor"
import { PagePreview } from "./page-preview"
import { invalidateEvent } from "../console-invalidate"
import { moveItem } from "../list-order"

const SLUG_DEBOUNCE_MS = 450

export function PageBuilderScreen() {
  const { t } = useT("host-page-builder")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const { eventId, event } = useConsoleEvent()

  const page = useQuery<EventPageDTO>({
    queryKey: consoleKeys.page(eventId),
    queryFn: () => api.getEventPage({ id: eventId }),
    retry: false,
  })
  const gate = useGate(page)

  const [blocks, setBlocks] = useState<EventPageBlock[] | null>(null)
  const [slug, setSlug] = useState<string | null>(null)
  const [accent, setAccent] = useState<ThemeAccent | null>(null)
  const [cover, setCover] = useState<ConsoleImage | null>(null)
  const [noindex, setNoindex] = useState<boolean | null>(null)
  const [addKind, setAddKind] = useState<EventPageBlockKind>("about")
  const [debouncedSlug, setDebouncedSlug] = useState("")
  const [serverFields, setServerFields] = useState<Record<string, string>>({})
  const [confirmUnpublish, setConfirmUnpublish] = useState(false)
  const [saveAttempted, setSaveAttempted] = useState(false)
  const [seededFrom, setSeededFrom] = useState<EventPageDTO | null>(null)

  const currentSlug = slug ?? ""
  const list = blocks ?? []
  const differsFrom = (data: EventPageDTO) =>
    currentSlug !== (data.slug ?? "") ||
    (accent ?? "bloom") !== data.theme.accent ||
    (cover?.mediaId ?? null) !== (data.coverMediaId ?? null) ||
    (noindex ?? false) !== data.seo.noindex ||
    blocksDiffer(list, data.blocks as EventPageBlock[])

  // A refetch reseeds the form only while it still matches the copy it was seeded from, so a server
  // change shows up without ever overwriting the host's unsaved edits.
  if (page.data && page.data !== seededFrom) {
    setSeededFrom(page.data)
    if (seededFrom === null || !differsFrom(seededFrom)) {
      setBlocks(withRowKeys(page.data.blocks as EventPageBlock[]))
      setSlug(page.data.slug ?? "")
      setAccent(page.data.theme.accent)
      setNoindex(page.data.seo.noindex)
      setCover(
        page.data.coverMediaId && page.data.coverUrl
          ? { mediaId: page.data.coverMediaId, url: page.data.coverUrl }
          : null,
      )
    }
  }

  const slugValid = currentSlug === "" || PageSlugSchema.safeParse(currentSlug).success

  useEffect(() => {
    if (!slugValid || currentSlug === "" || currentSlug === (page.data?.slug ?? "")) {
      setDebouncedSlug("")
      return
    }
    const handle = window.setTimeout(() => setDebouncedSlug(currentSlug), SLUG_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [currentSlug, slugValid, page.data?.slug])

  const slugCheck = useQuery<CheckEventPageSlugResponse>({
    queryKey: consoleKeys.slugCheck(eventId, debouncedSlug),
    enabled: debouncedSlug.length > 0,
    queryFn: () => api.checkEventPageSlug({ id: eventId, slug: debouncedSlug }),
    retry: false,
    staleTime: 60_000,
  })

  const blockErrors = saveAttempted ? blockSaveErrors(list) : {}
  const dirty = page.data !== undefined && blocks !== null && differsFrom(page.data)

  const save = useMutation({
    mutationFn: (saveBlocks: EventPageBlock[]) =>
      api.saveEventPage({
        id: eventId,
        slug: currentSlug === "" ? null : currentSlug,
        theme: { accent: accent ?? "bloom" },
        coverMediaId: cover?.mediaId ?? null,
        blocks: saveBlocks,
        seo: { noindex: noindex ?? false },
      }),
    onSuccess: (res) => {
      toast.toast({ title: t("saved"), tone: "success" })
      setSaveAttempted(false)
      setServerFields({})
      qc.setQueryData(consoleKeys.page(eventId), res)
      invalidateEvent(qc, eventId)
    },
    onError: (err) => {
      setServerFields(fieldErrorsFrom(err))
      toast.toast({ title: errors.message(err), tone: "danger" })
    },
  })

  const publish = useMutation({
    mutationFn: (published: boolean) => api.publishEventPage({ id: eventId, published }),
    onSuccess: (res) => {
      toast.toast({
        title: res.status === "published" ? t("published") : t("unpublished"),
        tone: "success",
      })
      setConfirmUnpublish(false)
      qc.setQueryData(consoleKeys.page(eventId), res)
      invalidateEvent(qc, eventId)
    },
    onError: (err) => {
      setServerFields(fieldErrorsFrom(err))
      toast.toast({ title: errors.message(err), tone: "danger" })
    },
  })

  /** Validates first so a blank row or cleared link is shown at its field, not as a failed save. */
  const saveBlocks = (then?: () => void) => {
    if (Object.keys(blockSaveErrors(list)).length > 0) {
      setSaveAttempted(true)
      toast.toast({ title: t("blocks.fix_errors"), tone: "danger" })
      return
    }
    save.mutate(normalizeBlocksForSave(list), then ? { onSuccess: then } : undefined)
  }

  // Publishing acts on the SAVED page, so unsaved edits are saved first rather than silently left
  // out of what goes live.
  const publishPage = () => {
    if (dirty) saveBlocks(() => publish.mutate(true))
    else publish.mutate(true)
  }

  const slugStatus = useMemo(() => {
    if (currentSlug === "") return null
    if (!slugValid) return { tone: "error" as const, message: t("slug.invalid") }
    if (currentSlug === (page.data?.slug ?? "")) return { tone: "ok" as const, message: t("slug.current") }
    if (slugCheck.isFetching) return { tone: "info" as const, message: t("slug.checking") }
    if (!slugCheck.data) return null
    if (slugCheck.data.available) return { tone: "ok" as const, message: t("slug.available") }
    return {
      tone: "error" as const,
      message: slugCheck.data.suggestion
        ? t("slug.taken_with_suggestion", { suggestion: slugCheck.data.suggestion })
        : t(`slug.reason_${slugCheck.data.reason ?? "taken"}`),
    }
  }, [currentSlug, page.data?.slug, slugCheck.data, slugCheck.isFetching, slugValid, t])

  const blockName = (kind: EventPageBlockKind, index: number) =>
    t("blocks.item_name", { kind: t(`block.kind.${kind}`), n: index + 1 })

  const published = page.data?.status === "published"
  const canPublish = currentSlug !== "" && list.length > 0 && !page.data?.flaggedAt

  return (
    <StateGate {...gate} onRetry={() => void page.refetch()} skeleton={<LoadingState count={6} />}>
      <div className="flex flex-col gap-token-5">
        <section className="flex flex-wrap items-center justify-between gap-token-3 rounded-md border border-console-line bg-console-surface px-token-4 py-token-3 shadow-console-1">
          <div className="flex flex-wrap items-center gap-token-3">
            {page.data ? <Chip kind="page-state" value={page.data.status} /> : null}
            {page.data?.flaggedAt ? (
              <span className="text-token-13 font-semibold text-console-bloom-strong">
                {t("flagged")}
              </span>
            ) : null}
            {page.data?.slug ? (
              <a
                href={`/e/${page.data.slug}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xs text-token-13 font-semibold text-console-sky-strong underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-console-ring"
              >
                {`/e/${page.data.slug}`}
              </a>
            ) : null}
          </div>
          <div className="flex items-center gap-token-2">
            <ConsoleButton
              variant="outline"
              size="sm"
              disabled={save.isPending}
              onClick={() => saveBlocks()}
            >
              {tc("action.save")}
            </ConsoleButton>
            {published ? (
              <ConsoleButton
                variant="secondary"
                size="sm"
                disabled={publish.isPending}
                onClick={() => setConfirmUnpublish(true)}
              >
                {t("unpublish")}
              </ConsoleButton>
            ) : (
              <ConsoleButton
                size="sm"
                disabled={publish.isPending || save.isPending || !canPublish}
                title={canPublish ? undefined : t("publish_blocked")}
                onClick={publishPage}
              >
                {t("publish")}
              </ConsoleButton>
            )}
          </div>
        </section>

        <div className="grid gap-token-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="flex flex-col gap-token-4">
            <section className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1">
              <h2 className="mb-token-3 font-display text-token-16 font-bold text-console-ink">
                {t("settings.title")}
              </h2>
              <div className="flex flex-col gap-token-4">
                <Field
                  label={t("slug.label")}
                  htmlFor="page-slug"
                  hint={t("slug.hint")}
                  error={serverFields.slug ?? (slugStatus?.tone === "error" ? slugStatus.message : undefined)}
                >
                  <TextInput
                    id="page-slug"
                    value={currentSlug}
                    maxLength={PAGE_SLUG_MAX}
                    autoComplete="off"
                    invalid={slugStatus?.tone === "error"}
                    onChange={(event) => setSlug(event.target.value.toLowerCase())}
                  />
                </Field>
                {slugStatus && slugStatus.tone !== "error" ? (
                  <p role="status" className="-mt-token-2 text-token-12 text-console-ink-3">
                    {slugStatus.message}
                  </p>
                ) : null}

                <Field label={t("theme.label")}>
                  <SegmentedControl
                    label={t("theme.label")}
                    value={accent ?? "bloom"}
                    onChange={(value) => setAccent(value)}
                    options={THEME_ACCENTS.map((value) => ({
                      value,
                      label: t(`theme.${value}`),
                    }))}
                  />
                </Field>

                <Field label={t("cover.label")} hint={t("cover.hint")}>
                  <CoverField value={cover} onChange={setCover} />
                </Field>

                <ToggleRow
                  label={t("seo.noindex")}
                  caption={t("seo.noindex_hint")}
                  checked={noindex ?? false}
                  onChange={setNoindex}
                />
              </div>
            </section>

            <section className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1">
              <div className="mb-token-3 flex flex-wrap items-center justify-between gap-token-2">
                <h2 className="font-display text-token-16 font-bold text-console-ink">
                  {t("blocks.title")}
                </h2>
                <div className="flex items-center gap-token-2">
                  <label className="sr-only" htmlFor="page-add-block">
                    {t("blocks.add_kind")}
                  </label>
                  <select
                    id="page-add-block"
                    value={addKind}
                    onChange={(event) => setAddKind(event.target.value as EventPageBlockKind)}
                    className="h-8 rounded-xs border border-console-line bg-console-surface px-token-2 text-token-13 text-console-ink focus-visible:outline-none focus-visible:shadow-console-ring"
                  >
                    {BLOCK_KINDS.map((kind) => (
                      <option key={kind} value={kind} disabled={!canAddBlock(list, kind)}>
                        {t(`block.kind.${kind}`)}
                      </option>
                    ))}
                  </select>
                  <ConsoleButton
                    size="sm"
                    variant="outline"
                    disabled={list.length >= MAX_EVENT_PAGE_BLOCKS || !canAddBlock(list, addKind)}
                    onClick={() => setBlocks([...(blocks ?? []), emptyBlock(addKind)])}
                  >
                    <Plus aria-hidden className="h-4 w-4" />
                    {t("blocks.add")}
                  </ConsoleButton>
                </div>
              </div>

              {serverFields.blocks ? (
                <p role="alert" className="mb-token-3 text-token-13 text-console-bloom-strong">
                  {serverFields.blocks}
                </p>
              ) : null}

              {list.length === 0 ? (
                <p className="text-token-13 text-console-ink-3">{t("blocks.empty")}</p>
              ) : (
                <ol className="flex flex-col gap-token-4">
                  {list.map((block, index) => (
                    <li
                      key={block.id}
                      className="rounded-sm border border-console-line bg-console-tint p-token-3"
                    >
                      <div className="mb-token-3 flex items-center gap-token-2">
                        <span className="text-token-13 font-bold text-console-ink">
                          {t(`block.kind.${block.kind}`)}
                        </span>
                        <span className="min-w-0 flex-1" />
                        <ConsoleIconButton
                          label={t("blocks.move_up_named", { name: blockName(block.kind, index) })}
                          disabled={index === 0}
                          onClick={() => setBlocks(moveItem(list, index, -1))}
                        >
                          <ArrowUp aria-hidden className="h-4 w-4" />
                        </ConsoleIconButton>
                        <ConsoleIconButton
                          label={t("blocks.move_down_named", {
                            name: blockName(block.kind, index),
                          })}
                          disabled={index === list.length - 1}
                          onClick={() => setBlocks(moveItem(list, index, 1))}
                        >
                          <ArrowDown aria-hidden className="h-4 w-4" />
                        </ConsoleIconButton>
                        <ConsoleIconButton
                          label={t("blocks.remove_named", { name: blockName(block.kind, index) })}
                          onClick={() => setBlocks(list.filter((item) => item.id !== block.id))}
                        >
                          <Trash2 aria-hidden className="h-4 w-4" />
                        </ConsoleIconButton>
                      </div>
                      <BlockEditor
                        block={block}
                        errors={blockErrors[block.id]}
                        onChange={(patch) => setBlocks(replaceBlock(list, block.id, patch))}
                      />
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <aside aria-label={t("preview.title")} className="xl:sticky xl:top-[140px] xl:self-start">
            <h2 className="mb-token-2 text-token-12 font-bold uppercase tracking-wider text-console-ink-3">
              {t("preview.title")}
            </h2>
            <PagePreview
              title={event.title ?? ""}
              accent={accent ?? "bloom"}
              coverUrl={cover?.url ?? null}
              blocks={list}
            />
          </aside>
        </div>
      </div>

      <ConfirmModal
        open={confirmUnpublish}
        severity="warn"
        title={t("unpublish_confirm.title")}
        body={t("unpublish_confirm.body")}
        confirmLabel={t("unpublish")}
        busy={publish.isPending}
        onCancel={() => setConfirmUnpublish(false)}
        onConfirm={() => publish.mutate(false)}
      />
    </StateGate>
  )
}
