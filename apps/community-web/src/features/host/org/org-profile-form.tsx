"use client"

import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { ExternalLink } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { OrganizationDTO, SocialLinks, SocialPlatform } from "@civfix/shared"
import {
  CreateOrganizationRequestSchema,
  ErrorCode,
  HTTPS_URL_MAX_LENGTH,
  MAX_ORG_DESCRIPTION,
  MAX_ORG_NAME,
  ORG_SLUG_MAX,
  ORG_SLUG_MIN,
  SafeHttpsLinkSchema,
  SOCIAL_HANDLE_MAX_LENGTH,
  SOCIAL_HANDLE_PREFIX,
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  UpdateOrganizationRequestSchema,
  WHATSAPP_NUMBER_MAX_LENGTH,
  toAppError,
} from "@civfix/shared"
import { useApi, useAuthState } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"
import { ConsoleButton } from "@/components/console/button"
import { Field } from "@/components/console/forms/field"
import { CONSOLE_INPUT_CLASSES, TextInput, TextArea } from "@/components/console/forms/inputs"
import { ErrorSummary } from "@/components/console/forms/error-summary"
import type { FieldError } from "@/components/console/forms/error-summary"
import { DraftRestoredBar } from "@/components/console/forms/draft-restored-bar"
import { LogoField } from "@/components/console/forms/image-upload"
import type { ConsoleImage } from "@/components/console/forms/image-upload"
import { useConsoleToast } from "@/components/console/overlay/toast"
import { useDraft, consoleDraftKey } from "@/components/console/use-draft"
import { fieldErrorsFrom } from "@/components/console/query-state"

import { useConsoleErrors } from "../error-copy"
import { invalidateOrg, upsertMyOrganization } from "../console-invalidate"
import { firstIssueByPath } from "../form-issues"
import {
  PUBLIC_ORG_HOST,
  orgSlugProblem,
  publicOrgPath,
  publicOrgUrlLabel,
  slugFromOrgName,
} from "./org-slug"
import type { OrgSlugProblem } from "./org-slug"
import { suspendedForbiddenCopy } from "./org-copy"
import type { Translate } from "@civfix/ui/i18n"

const SECTION_CLASSES =
  "rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1"
const PREFIX_BOX_CLASSES =
  "inline-flex items-center rounded-l-xs border border-r-0 border-console-line bg-console-surface-alt"

export interface OrgProfileDraft {
  name: string
  slug: string
  /** Once the host edits the slug by hand we stop deriving it from the name. */
  slugTouched: boolean
  description: string
  websiteUrl: string
  donationUrl: string
  facebook: string
  instagram: string
  tiktok: string
  x: string
  whatsapp: string
}

export const EMPTY_ORG_DRAFT: OrgProfileDraft = {
  name: "",
  slug: "",
  slugTouched: false,
  description: "",
  websiteUrl: "",
  donationUrl: "",
  facebook: "",
  instagram: "",
  tiktok: "",
  x: "",
  whatsapp: "",
}

function draftFromOrg(org: OrganizationDTO | null): OrgProfileDraft {
  if (!org) return EMPTY_ORG_DRAFT
  const links = org.socialLinks ?? {}
  return {
    name: org.name,
    slug: org.slug,
    slugTouched: true,
    description: org.description ?? "",
    websiteUrl: org.websiteUrl ?? "",
    donationUrl: org.donationUrl ?? "",
    facebook: links.facebook ?? "",
    instagram: links.instagram ?? "",
    tiktok: links.tiktok ?? "",
    x: links.x ?? "",
    whatsapp: links.whatsapp ?? "",
  }
}

/**
 * The social-links object the contract expects, or null when every handle is blank. A leading `@`
 * is dropped the way the invite drawer drops it from a handle: people paste "@riverkeepers" and
 * the field already shows the platform prefix.
 */
export function socialLinksFromDraft(draft: OrgProfileDraft): SocialLinks | null {
  const out: SocialLinks = {}
  let any = false
  for (const platform of SOCIAL_PLATFORMS) {
    const value = draft[platform].trim().replace(/^@/, "")
    if (value === "") continue
    out[platform] = value
    any = true
  }
  return any ? out : null
}

type ProfileMode = OrgProfileFormProps["mode"]

interface ProfileBody {
  name: string
  description: string | null
  websiteUrl: string | null
  logoMediaId: string | null
  socialLinks: SocialLinks | null
}

function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

function bodyFromDraft(draft: OrgProfileDraft, logo: ConsoleImage | null): ProfileBody {
  return {
    name: draft.name.trim(),
    description: trimmedOrNull(draft.description),
    websiteUrl: trimmedOrNull(draft.websiteUrl),
    logoMediaId: logo?.mediaId ?? null,
    socialLinks: socialLinksFromDraft(draft),
  }
}

function editBodyFromDraft(
  draft: OrgProfileDraft,
  logo: ConsoleImage | null,
): ProfileBody & { donationUrl: string | null } {
  return { ...bodyFromDraft(draft, logo), donationUrl: trimmedOrNull(draft.donationUrl) }
}

function donationLinkUnsafe(value: string): boolean {
  const trimmed = trimmedOrNull(value)
  return trimmed !== null && !SafeHttpsLinkSchema.safeParse(trimmed).success
}

const SLUG_PROBLEM_DEFAULTS: Record<OrgSlugProblem, string> = {
  empty: "Choose a handle for the public page.",
  short: `Handles need at least ${ORG_SLUG_MIN} characters.`,
  long: `Handles can be at most ${ORG_SLUG_MAX} characters.`,
  format: "Use lowercase letters, numbers and single dashes.",
}

const FIELD_LABEL_DEFAULTS: Record<string, string> = {
  name: "Name",
  slug: "Handle",
  description: "Description",
  websiteUrl: "Website",
  donationUrl: "Donation link",
}

const SOCIAL_KEY_PREFIX = "socialLinks."

function socialFieldKey(platform: SocialPlatform): string {
  return `${SOCIAL_KEY_PREFIX}${platform}`
}

function slugTakenCopy(t: Translate): string {
  return t("form.slug_taken", { defaultValue: "That handle is already taken. Try another." })
}

/**
 * The form's own validation: the request schema for the mode, with the slug, link and handle
 * messages replaced by copy that says what to type.
 */
function orgProfileLocalErrors(
  draft: OrgProfileDraft,
  logo: ConsoleImage | null,
  mode: ProfileMode,
  orgId: string,
  t: Translate,
): Record<string, string> {
  const parsed =
    mode === "create"
      ? CreateOrganizationRequestSchema.safeParse({
          ...bodyFromDraft(draft, logo),
          slug: draft.slug.trim(),
        })
      : UpdateOrganizationRequestSchema.safeParse({
          id: orgId,
          ...editBodyFromDraft(draft, logo),
        })
  const out: Record<string, string> = parsed.success
    ? {}
    : firstIssueByPath(parsed.error.issues, "path")
  if (mode === "create") {
    const problem = orgSlugProblem(draft.slug)
    if (problem) {
      out.slug = t(`form.slug_${problem}`, {
        min: ORG_SLUG_MIN,
        max: ORG_SLUG_MAX,
        defaultValue: SLUG_PROBLEM_DEFAULTS[problem],
      })
    }
  }
  if (out.websiteUrl) {
    out.websiteUrl = t("form.website_invalid", {
      defaultValue: "Enter a full https:// address.",
    })
  }
  if (out.donationUrl || donationLinkUnsafe(draft.donationUrl)) {
    out.donationUrl = t("form.donation_invalid")
  }
  for (const platform of SOCIAL_PLATFORMS) {
    const key = socialFieldKey(platform)
    if (out[key]) {
      out[key] =
        platform === "whatsapp"
          ? t("form.whatsapp_invalid", {
              defaultValue: "Enter the number with country code, digits only.",
            })
          : t("form.handle_invalid", {
              defaultValue: "Handles use letters, numbers, dots and underscores.",
            })
    }
  }
  return out
}

/**
 * Field messages for a failed save. A reserved handle comes back as a bare VALIDATION about the
 * slug, with no field map; any other field-less validation error is shown as it came, and one with
 * fields shows them.
 */
function orgSaveErrorFields(err: unknown, mode: ProfileMode, t: Translate): Record<string, string> {
  const fields = fieldErrorsFrom(err)
  const app = toAppError(err)
  if (app.code === ErrorCode.CONFLICT) {
    fields.slug = slugTakenCopy(t)
  } else if (
    app.code === ErrorCode.VALIDATION &&
    mode === "create" &&
    Object.keys(fields).length === 0 &&
    /slug|handle|reserved/i.test(app.message)
  ) {
    fields.slug = t("form.slug_reserved", {
      defaultValue: "That handle is reserved. Try another.",
    })
  }
  return fields
}

function orgFieldLabel(key: string, t: Translate): string {
  if (key.startsWith(SOCIAL_KEY_PREFIX)) {
    return SOCIAL_PLATFORM_LABELS[key.slice(SOCIAL_KEY_PREFIX.length) as SocialPlatform]
  }
  return t(`form.${key}`, { defaultValue: FIELD_LABEL_DEFAULTS[key] ?? key })
}

interface SlugStatus {
  tone: "error" | "ok"
  message: string
}

/** The live verdict under the create-mode slug field; a server refusal outranks the local check. */
function slugStatusFor(
  mode: ProfileMode,
  slug: string,
  serverError: string | undefined,
  localError: string | undefined,
  okMessage: string,
): SlugStatus | null {
  if (mode !== "create" || slug === "") return null
  if (serverError) return { tone: "error", message: serverError }
  if (localError) return { tone: "error", message: localError }
  return { tone: "ok", message: okMessage }
}

export interface OrgProfileFormProps {
  mode: "create" | "edit"
  org?: OrganizationDTO | null
  onSaved: (org: OrganizationDTO) => void
  onCancel?: () => void
  /** Suspended org (edit mode): the server refuses the write, so the submit is disabled. */
  disabled?: boolean
}

export function OrgProfileForm({
  mode,
  org = null,
  onSaved,
  onCancel,
  disabled = false,
}: OrgProfileFormProps) {
  const { t } = useT("host-org")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const viewerId = useAuthState().user?.id ?? null

  const draftKey = consoleDraftKey("org-profile", org?.id ?? "new", viewerId)
  const initial = useMemo(() => draftFromOrg(org), [org])
  const { draft, patch, dirty, restored, dismissRestored, clear } = useDraft(draftKey, initial)
  const [logo, setLogo] = useState<ConsoleImage | null>(
    org?.logoMediaId && org.logoUrl ? { mediaId: org.logoMediaId, url: org.logoUrl } : null,
  )
  const [serverFields, setServerFields] = useState<Record<string, string>>({})
  const [submitCount, setSubmitCount] = useState(0)

  const slug = mode === "create" ? draft.slug : (org?.slug ?? draft.slug)

  const localErrors = useMemo(
    () => orgProfileLocalErrors(draft, logo, mode, org?.id ?? "", t),
    [draft, logo, mode, org?.id, t],
  )

  const fieldErrors = { ...localErrors, ...serverFields }
  const summary: FieldError[] = Object.entries(fieldErrors).map(([key, message]) => ({
    id: `org-${key.replace(".", "-")}`,
    message: `${orgFieldLabel(key, t)}: ${message}`,
  }))

  const save = useMutation({
    mutationFn: async () => {
      if (mode === "edit" && org) {
        return api.updateOrganization({ id: org.id, ...editBodyFromDraft(draft, logo) })
      }
      return api.createOrganization({ ...bodyFromDraft(draft, logo), slug: draft.slug.trim() })
    },
    onSuccess: (saved) => {
      toast.toast({
        title:
          mode === "edit"
            ? t("form.saved", { defaultValue: "Organization saved" })
            : t("form.created", { defaultValue: "Organization created" }),
        tone: "success",
      })
      setServerFields({})
      clear()
      // Seat the org in the list before the overview mounts, so it never reads as not found.
      upsertMyOrganization(qc, saved)
      invalidateOrg(qc, saved.id)
      onSaved(saved)
    },
    onError: (err) => {
      setServerFields(orgSaveErrorFields(err, mode, t))
      setSubmitCount((count) => count + 1)
      toast.toast({
        title: errors.message(err, {
          CONFLICT: slugTakenCopy(t),
          ...(disabled ? { FORBIDDEN: suspendedForbiddenCopy(t) } : {}),
        }),
        tone: "danger",
      })
    },
  })

  const submit = () => {
    setSubmitCount((count) => count + 1)
    if (Object.keys(localErrors).length > 0) return
    save.mutate()
  }

  const onNameChange = (name: string) => {
    patch(
      mode === "create" && !draft.slugTouched
        ? { name, slug: slugFromOrgName(name) }
        : { name },
    )
  }

  const onSlugChange = (value: string) => {
    setServerFields((current) => {
      if (!current.slug) return current
      const next = { ...current }
      delete next.slug
      return next
    })
    patch({ slug: value.toLowerCase(), slugTouched: true })
  }

  const showError = (key: string) => (submitCount > 0 ? fieldErrors[key] : undefined)
  const slugStatus = slugStatusFor(
    mode,
    draft.slug,
    serverFields.slug,
    mode === "create" ? localErrors.slug : undefined,
    t("form.slug_ok", { defaultValue: "Looks good" }),
  )

  const canSubmit =
    !disabled &&
    !save.isPending &&
    (mode === "create" || dirty || logo?.mediaId !== (org?.logoMediaId ?? null))

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="flex flex-col gap-token-5"
    >
      {restored ? (
        <DraftRestoredBar
          onDiscard={() => {
            clear()
            dismissRestored()
          }}
        />
      ) : null}
      <ErrorSummary errors={submitCount > 0 ? summary : []} submitCount={submitCount} />

      <FormSection
        title={t("form.identity_title", { defaultValue: "Identity" })}
        intro={t("form.identity_body", {
          defaultValue: "How the organization appears on events, receipts and its public page.",
        })}
      >
        <div className="flex flex-col gap-token-4 sm:flex-row sm:items-start">
          <Field
            announceError={false}
            label={t("form.logo", { defaultValue: "Logo" })}
            optional
            hint={t("form.logo_hint", { defaultValue: "Square image, shown at small sizes." })}
            className="shrink-0"
          >
            <LogoField value={logo} onChange={setLogo} disabled={save.isPending} />
          </Field>
          <div className="flex min-w-0 flex-1 flex-col gap-token-4">
            <Field
              announceError={false}
              label={t("form.name", { defaultValue: "Name" })}
              htmlFor="org-name"
              error={showError("name")}
              counter={`${draft.name.length}/${MAX_ORG_NAME}`}
            >
              <TextInput
                id="org-name"
                value={draft.name}
                maxLength={MAX_ORG_NAME}
                autoComplete="organization"
                invalid={Boolean(showError("name"))}
                onChange={(event) => onNameChange(event.target.value)}
              />
            </Field>
            {mode === "create" ? (
              <NewSlugField
                slug={draft.slug}
                status={slugStatus}
                submitted={submitCount > 0}
                onChange={onSlugChange}
              />
            ) : (
              <LockedSlugField slug={slug} />
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title={t("form.about_title", { defaultValue: "About" })}>
        <div className="flex flex-col gap-token-4">
          <Field
            announceError={false}
            label={t("form.description", { defaultValue: "Description" })}
            htmlFor="org-description"
            optional
            hint={t("form.description_hint", {
              defaultValue: "What you do and who you serve. Shown on the public page.",
            })}
            error={showError("description")}
            counter={`${draft.description.length}/${MAX_ORG_DESCRIPTION}`}
          >
            <TextArea
              id="org-description"
              rows={5}
              value={draft.description}
              maxLength={MAX_ORG_DESCRIPTION}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </Field>
          <Field
            announceError={false}
            label={t("form.websiteUrl", { defaultValue: "Website" })}
            htmlFor="org-website"
            optional
            error={showError("websiteUrl")}
            hint={t("form.website_hint", { defaultValue: "Must start with https://" })}
          >
            <TextInput
              id="org-website"
              type="url"
              inputMode="url"
              placeholder="https://"
              maxLength={HTTPS_URL_MAX_LENGTH}
              value={draft.websiteUrl}
              invalid={Boolean(showError("websiteUrl"))}
              onChange={(event) => patch({ websiteUrl: event.target.value })}
            />
          </Field>
          {mode === "edit" ? (
            <Field
              announceError={false}
              label={t("form.donationUrl")}
              htmlFor="org-donation-url"
              optional
              error={showError("donationUrl")}
              hint={t("form.donation_hint")}
            >
              <TextInput
                id="org-donation-url"
                type="url"
                inputMode="url"
                placeholder="https://"
                maxLength={HTTPS_URL_MAX_LENGTH}
                value={draft.donationUrl}
                invalid={Boolean(showError("donationUrl"))}
                onChange={(event) => patch({ donationUrl: event.target.value })}
              />
            </Field>
          ) : null}
        </div>
      </FormSection>

      <FormSection
        title={t("form.social_title", { defaultValue: "Social links" })}
        intro={t("form.social_body", {
          defaultValue: "Just the handle - we build the link. All optional.",
        })}
      >
        <div className="grid gap-token-3 sm:grid-cols-2">
          {SOCIAL_PLATFORMS.map((platform) => (
            <SocialLinkField
              key={platform}
              platform={platform}
              value={draft[platform]}
              error={showError(socialFieldKey(platform))}
              onChange={(value) => patch({ [platform]: value } as Partial<OrgProfileDraft>)}
            />
          ))}
        </div>
      </FormSection>

      <div className="flex flex-wrap items-center justify-end gap-token-2">
        {onCancel ? (
          <ConsoleButton variant="ghost" onClick={onCancel} disabled={save.isPending}>
            {tc("action.cancel")}
          </ConsoleButton>
        ) : null}
        <ConsoleButton
          type="submit"
          disabled={!canSubmit}
          title={disabled ? suspendedForbiddenCopy(t) : undefined}
        >
          {save.isPending
            ? tc("action.loading")
            : mode === "edit"
              ? tc("action.save")
              : t("form.create_action", { defaultValue: "Create organization" })}
        </ConsoleButton>
      </div>
    </form>
  )
}

function FormSection({
  title,
  intro,
  children,
}: {
  title: string
  intro?: string
  children: ReactNode
}) {
  return (
    <section className={SECTION_CLASSES}>
      <h2
        className={`${intro === undefined ? "mb-token-4" : "mb-token-1"} font-display text-token-16 font-bold text-console-ink`}
      >
        {title}
      </h2>
      {intro === undefined ? null : (
        <p className="mb-token-4 text-token-13 text-console-ink-3">{intro}</p>
      )}
      {children}
    </section>
  )
}

/** A fixed prefix (host, platform domain) joined to the input it precedes. */
function InputPrefix({
  prefix,
  compact = false,
  children,
}: {
  prefix: string
  compact?: boolean
  children: ReactNode
}) {
  return (
    <span className="flex w-full items-stretch">
      <span
        className={`${PREFIX_BOX_CLASSES} ${compact ? "px-token-2 text-token-12" : "px-token-3 text-token-13"} text-console-ink-3`}
      >
        {prefix}
      </span>
      {children}
    </span>
  )
}

function NewSlugField({
  slug,
  status,
  submitted,
  onChange,
}: {
  slug: string
  status: SlugStatus | null
  submitted: boolean
  onChange: (value: string) => void
}) {
  const { t } = useT("host-org")
  const failing = submitted && status?.tone === "error"
  return (
    <Field
      announceError={false}
      label={t("form.slug", { defaultValue: "Handle" })}
      htmlFor="org-slug"
      error={failing ? status.message : undefined}
      hint={
        status?.tone === "ok"
          ? `${publicOrgUrlLabel(slug)} · ${status.message}`
          : t("form.slug_hint", {
              host: PUBLIC_ORG_HOST,
              defaultValue: `Your public page lives at ${PUBLIC_ORG_HOST}/orgs/<handle>. Lowercase letters, numbers and dashes.`,
            })
      }
    >
      <InputPrefix prefix={`${PUBLIC_ORG_HOST}/orgs/`}>
        <TextInput
          id="org-slug"
          value={slug}
          maxLength={ORG_SLUG_MAX}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="rounded-l-none"
          invalid={failing}
          onChange={(event) => onChange(event.target.value)}
        />
      </InputPrefix>
    </Field>
  )
}

function LockedSlugField({ slug }: { slug: string }) {
  const { t } = useT("host-org")
  return (
    <Field
      announceError={false}
      label={t("form.slug", { defaultValue: "Handle" })}
      htmlFor="org-slug"
      hint={t("form.slug_locked", {
        defaultValue: "Handles cannot be changed once the organization exists.",
      })}
    >
      <span className="flex flex-wrap items-center gap-token-2">
        <TextInput id="org-slug" value={`@${slug}`} readOnly className="max-w-xs" />
        <a
          href={publicOrgPath(slug)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-xs text-token-13 font-semibold text-console-sky-strong underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-console-ring"
        >
          {publicOrgUrlLabel(slug)}
          <ExternalLink aria-hidden className="h-3.5 w-3.5" />
        </a>
      </span>
    </Field>
  )
}

function SocialLinkField({
  platform,
  value,
  error,
  onChange,
}: {
  platform: SocialPlatform
  value: string
  error: string | undefined
  onChange: (value: string) => void
}) {
  const id = `org-social-${platform}`
  const whatsapp = platform === "whatsapp"
  return (
    <Field
      announceError={false}
      label={SOCIAL_PLATFORM_LABELS[platform]}
      htmlFor={id}
      optional
      error={error}
    >
      <InputPrefix prefix={SOCIAL_HANDLE_PREFIX[platform]} compact>
        <input
          id={id}
          value={value}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          inputMode={whatsapp ? "tel" : "text"}
          maxLength={whatsapp ? WHATSAPP_NUMBER_MAX_LENGTH : SOCIAL_HANDLE_MAX_LENGTH}
          aria-invalid={error ? true : undefined}
          className={cn(CONSOLE_INPUT_CLASSES, "rounded-l-none", error && "border-console-bloom-strong")}
          onChange={(event) => onChange(event.target.value)}
        />
      </InputPrefix>
    </Field>
  )
}
