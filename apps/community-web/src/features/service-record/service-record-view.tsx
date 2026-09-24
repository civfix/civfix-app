"use client"

import * as React from "react"
import {
  BadgeCheck,
  Copy,
  Loader2,
  Printer,
  SearchX,
  ShieldCheck,
  ShieldX,
} from "lucide-react"
import {
  ErrorCode,
  formatCertificateCode,
  formatCertificateHours,
  formatCount,
  normalizeCertificateCode,
  type VerifyCertificateResponse,
} from "@civfix/shared"
import { safeDateFormat } from "@civfix/shared/datetime"
import { EMPTY_VALUE, useT } from "@civfix/ui/i18n"

import { DetailShell } from "@/components/detail-shell"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { api, toAppError } from "@/lib/api"
import { replaceUrlInPlace } from "@/lib/replace-url"
import {
  SERVICE_RECORD_SEGMENT,
  serviceRecordCodeFromPath,
  serviceRecordPath,
} from "@/features/service-record/service-record-code"

const COPIED_FLASH_MS = 2000

// The printed "CFX-XXXX-XXXX-XXXX" form is 18 characters, so this leaves one to spare; normalization
// strips the separators anyway.
const CODE_INPUT_MAX_LENGTH = 19

/**
 * The public certificate verification page, for a registrar or court clerk holding a printed transcript
 * with no civfix account. It is plain DOM rather than a @civfix/ui body because react-native-web bodies
 * print badly (absolutely positioned flex scaffolding, no page breaks), and printing is a first-class use
 * here. The response is deliberately thin: everything shown is already printed on the document.
 */

/** `record` covers both verdicts; `status` distinguishes them. */
type Phase =
  | { readonly kind: "idle" }
  | { readonly kind: "checking" }
  | { readonly kind: "record"; readonly record: VerifyCertificateResponse }
  | { readonly kind: "error"; readonly reason: "notFound" | "badCode" | "network" }

export function ServiceRecordView() {
  const { t, i18n } = useT("web-service-record")
  const locale = i18n.language

  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" })
  const [input, setInput] = React.useState("")

  // Only the latest request may write state, so a fast second submit is never overwritten by the first
  // response landing late.
  const requestSeq = React.useRef(0)
  // StrictMode double-invokes effects; a ref survives that, so the mount seed runs once.
  const seeded = React.useRef(false)

  const verify = React.useCallback(async (code: string) => {
    const seq = ++requestSeq.current
    setPhase({ kind: "checking" })
    try {
      const record = await api.verifyServiceHoursCertificate({ code })
      if (requestSeq.current !== seq) return
      setPhase({ kind: "record", record })
    } catch (err) {
      if (requestSeq.current !== seq) return
      // NOT_FOUND (no such code) and VALIDATION (the server rejected the shape) are the two verdicts a
      // verifier can act on; everything else - offline, 5xx, rate limit - is "we could not reach civfix".
      const { code: errorCode } = toAppError(err)
      setPhase({
        kind: "error",
        reason:
          errorCode === ErrorCode.NOT_FOUND
            ? "notFound"
            : errorCode === ErrorCode.VALIDATION
              ? "badCode"
              : "network",
      })
    }
  }, [])

  React.useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    const source = serviceRecordCodeFromPath(
      typeof window === "undefined" ? null : window.location.pathname,
    )
    if (source.kind === "code") {
      setInput(formatCertificateCode(source.code))
      void verify(source.code)
    } else if (source.kind === "invalid") {
      setInput(source.raw)
      setPhase({ kind: "error", reason: "badCode" })
    }
  }, [verify])

  const onSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      // The same normalization as the URL path, so a typed code behaves exactly like one from a link.
      const code = normalizeCertificateCode(input)
      if (code === null) {
        requestSeq.current += 1 // abandon anything in flight so it cannot overwrite this verdict
        setPhase({ kind: "error", reason: "badCode" })
        return
      }
      // Replace, not push, so Back leaves the page rather than walking back through typed codes.
      if (typeof window !== "undefined") {
        replaceUrlInPlace(serviceRecordPath(code))
      }
      void verify(code)
    },
    [input, verify],
  )

  const reset = React.useCallback(() => {
    requestSeq.current += 1
    setInput("")
    setPhase({ kind: "idle" })
    if (typeof window !== "undefined") {
      replaceUrlInPlace(`/${SERVICE_RECORD_SEGMENT}/`)
    }
  }, [])

  return (
    <div className="sr-page">
      <DetailShell maxWidth="max-w-2xl">
        {phase.kind === "checking" ? (
          <CheckingState label={t("checking")} />
        ) : phase.kind === "record" ? (
          <RecordVerdict record={phase.record} locale={locale} onReset={reset} />
        ) : phase.kind === "error" ? (
          <ErrorVerdict reason={phase.reason} onReset={reset} />
        ) : (
          <CodeForm value={input} onChange={setInput} onSubmit={onSubmit} />
        )}
      </DetailShell>
    </div>
  )
}

function CodeForm({
  value,
  onChange,
  onSubmit,
}: {
  value: string
  onChange: (next: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  const { t } = useT("web-service-record")
  const inputId = React.useId()

  return (
    <div className="text-center">
      <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-pill bg-bloom-50 text-primary">
        <ShieldCheck className="h-7 w-7" aria-hidden="true" />
      </span>
      <h1 className="font-display text-token-30 font-extrabold text-ink">{t("title")}</h1>
      <p className="mx-auto mt-2 max-w-md text-token-15 text-ink-2">{t("subtitle")}</p>

      <form className="mx-auto mt-6 flex max-w-sm flex-col gap-3 text-left" onSubmit={onSubmit}>
        <label className="text-token-13 font-semibold text-ink-2" htmlFor={inputId}>
          {t("enter_code")}
        </label>
        <input
          id={inputId}
          className="w-full rounded-md border border-ink-5 bg-cardflat px-3 py-2 font-mono text-token-16 uppercase tracking-wider text-ink placeholder:text-ink-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("code_placeholder")}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={CODE_INPUT_MAX_LENGTH}
        />
        <Button type="submit" size="lg" disabled={value.trim().length === 0}>
          {t("verify")}
        </Button>
      </form>

      <Disclaimer />
    </div>
  )
}

function CheckingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" aria-live="polite">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <p className="mt-3 text-token-15 text-ink-2">{label}</p>
    </div>
  )
}

/**
 * Both verdicts carry the disclaimer, because both confirm only the existence and totals of a record,
 * never its individual activities.
 */
function RecordVerdict({
  record,
  locale,
  onReset,
}: {
  record: VerifyCertificateResponse
  locale: string
  onReset: () => void
}) {
  const { t } = useT("web-service-record")
  const revoked = record.status === "revoked"
  const holder = record.holderName?.trim() || (record.holderHandle ? `@${record.holderHandle}` : null)

  return (
    <div>
      <section
        className={`sr-card rounded-lg border p-6 text-center shadow-s1 ${
          revoked ? "border-ink-5 bg-paper2" : "border-moss-300 bg-moss-50"
        }`}
        aria-live="polite"
      >
        <span
          className={`sr-verdict-icon mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-pill ${
            revoked ? "bg-cardflat text-ink-3" : "bg-moss-100 text-moss-600"
          }`}
        >
          {revoked ? (
            <ShieldX className="h-7 w-7" aria-hidden="true" />
          ) : (
            <BadgeCheck className="h-7 w-7" aria-hidden="true" />
          )}
        </span>

        <h1 className="font-display text-token-30 font-extrabold text-ink">
          {revoked ? t("revoked_title") : t("valid_title")}
        </h1>

        {revoked ? (
          <p className="mx-auto mt-2 max-w-md text-token-15 text-ink-2">
            {t("revoked_body", { date: formatDate(record.revokedAt, locale) })}
          </p>
        ) : (
          <>
            {holder !== null && (
              <p className="mx-auto mt-2 max-w-md text-token-15 text-ink-2">
                {t("valid_subtitle", { name: holder })}
              </p>
            )}
            {/* The icon above is decorative; this carries the verdict to assistive tech. */}
            <p className="sr-only">{t("valid_a11y")}</p>
          </>
        )}

        <p className="sr-code mt-4 font-mono text-token-18 font-semibold tracking-wider text-ink">
          {formatCertificateCode(record.code)}
        </p>
      </section>

      <dl className="sr-card mt-4 grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-ink-5 bg-cardflat p-5 sm:grid-cols-2">
        <Field label={t("issued")} value={formatDate(record.issuedAt, locale)} />
        <Field label={t("hours")} value={formatCertificateHours(record.totalHours, locale)} />
        <Field label={t("activities")} value={formatCount(record.entryCount, locale)} />
        {record.periodStart && record.periodEnd && (
          <Field
            label={t("period")}
            value={t("period_value", {
              start: formatDate(record.periodStart, locale),
              end: formatDate(record.periodEnd, locale),
            })}
          />
        )}
        {record.jurisdictionNames && record.jurisdictionNames.length > 0 && (
          <Field label={t("communities")} value={record.jurisdictionNames.join(", ")} />
        )}
      </dl>

      {record.documentSha256 && <Fingerprint sha256={record.documentSha256} />}

      <Disclaimer />

      <div className="sr-no-print mt-5 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden="true" />
          {t("print")}
        </Button>
        <Button variant="ghost" onClick={onReset}>
          {t("try_again")}
        </Button>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-token-12 font-semibold uppercase tracking-wider text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-token-15 text-ink">{value}</dd>
    </div>
  )
}

/**
 * Copy is best-effort: the Clipboard API is unavailable on insecure origins and in some embedded
 * browsers, and the value stays selectable either way.
 */
function Fingerprint({ sha256 }: { sha256: string }) {
  const { t } = useT("web-service-record")
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_FLASH_MS)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = React.useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return
    navigator.clipboard.writeText(sha256).then(
      () => setCopied(true),
      () => {
        // Permission denied / insecure origin: the value is still on screen and selectable.
      },
    )
  }, [sha256])

  return (
    <div className="sr-card mt-4 rounded-lg border border-ink-5 bg-cardflat p-5">
      <p className="text-token-12 font-semibold uppercase tracking-wider text-ink-3">
        {t("fingerprint")}
      </p>
      <div className="mt-1.5 flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all font-mono text-token-13 text-ink-2">{sha256}</code>
        <button
          type="button"
          onClick={copy}
          aria-label={t("fingerprint_copy_a11y")}
          className="sr-no-print inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1 text-token-13 font-semibold text-ink-2 transition-colors duration-d2 ease-out hover:bg-paper2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        {/* Outside the button: its accessible name is fixed by aria-label, so text inside it is never
            announced. The region stays mounted so screen readers pick up the change. */}
        <span role="status" className="sr-no-print shrink-0 py-1 text-token-13 font-semibold text-ink-2">
          {copied ? t("copied") : ""}
        </span>
      </div>
    </div>
  )
}

function ErrorVerdict({
  reason,
  onReset,
}: {
  reason: "notFound" | "badCode" | "network"
  onReset: () => void
}) {
  const { t } = useT("web-service-record")
  const body =
    reason === "notFound" ? t("not_found") : reason === "badCode" ? t("bad_code") : t("error")

  return (
    <div>
      {/* The page keeps a real <h1> in every state, so this publicly linkable document is never
          headingless whatever the failure reason. */}
      <h1 className="mb-4 text-center font-display text-token-30 font-extrabold text-ink">
        {t("title")}
      </h1>
      <EmptyState
        icon={
          reason === "network" ? (
            <ShieldX className="h-6 w-6" aria-hidden="true" />
          ) : (
            <SearchX className="h-6 w-6" aria-hidden="true" />
          )
        }
        iconTone="neutral"
        body={<span aria-live="polite">{body}</span>}
        action={
          <Button variant="outline" onClick={onReset}>
            {t("try_again")}
          </Button>
        }
      />
      <Disclaimer />
    </div>
  )
}

/** Rendered in every state, including the empty form, so a verifier never sees it only after a match. */
function Disclaimer() {
  const { t } = useT("web-service-record")
  return (
    <p className="sr-disclaimer mx-auto mt-6 max-w-md text-center text-token-13 text-ink-3">
      {t("disclaimer")}
    </p>
  )
}

const ISSUED_DATE_OPTIONS: Intl.DateTimeFormatOptions = { dateStyle: "medium" }

/** An absent or unparseable timestamp renders as a placeholder, never "Invalid Date". */
function formatDate(iso: string | null | undefined, locale: string): string {
  return safeDateFormat(iso, locale, ISSUED_DATE_OPTIONS) || EMPTY_VALUE
}
