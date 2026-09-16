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
  normalizeCertificateCode,
  type VerifyCertificateResponse,
} from "@civfix/shared"
import { useT } from "@civfix/ui/i18n"

import { DetailShell } from "@/components/detail-shell"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { api, toAppError } from "@/lib/api"
import {
  serviceRecordCodeFromPath,
  serviceRecordPath,
} from "@/features/service-record/service-record-code"

/**
 * /service-record/<code> - the PUBLIC service-hours certificate verification page.
 *
 * The audience is a school registrar or a court clerk holding a printed civfix transcript, on a desktop
 * browser, with no civfix account. Three consequences shape this file:
 *
 *  1. It is plain DOM inside the existing DetailShell (the /claim precedent), NOT a @civfix/ui body.
 *     react-native-web bodies print badly (absolutely-positioned flex scaffolding, no page breaks), and
 *     printing is a first-class use of this page - see service-record.css's `@media print` block.
 *  2. It calls the shared client with NO auth. `verifyServiceHoursCertificate` is declared
 *     `auth: "public"`, so the client attaches no bearer at all: the page works signed-out and cold.
 *  3. The code comes from `window.location.pathname`, never `usePathname()`. Under output:"export" the
 *     Cloudflare rule `/service-record/* -> /service-record/_/ 200` rewrites the request server-side, so
 *     Next's router sees the placeholder document while the address bar still holds the real deep link.
 *     The parsing (and the `/_/` placeholder guard) lives in the pure service-record-code.ts, mirroring
 *     `seedPathname()` in components/home/use-web-nav-adapter.ts.
 *
 * The response is deliberately thin (no user id, no PDF url, no per-activity rows) - everything shown
 * here is already printed on the document the verifier is holding, which is why the disclaimer says so.
 */

/** What the page is currently showing. `record` covers both verdicts; `status` distinguishes them. */
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

  // Sequences the verify GETs: only the LATEST request may write state, so a fast second submit cannot
  // be overwritten by the first response landing late.
  const requestSeq = React.useRef(0)
  // The mount seed runs at most once (React 19 StrictMode double-invokes effects; refs survive that).
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

  // Seed from the live URL on mount. A cold deep link verifies immediately; a bare /service-record/ (or
  // the /_/ placeholder document itself) falls through to the "enter a code" form.
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
      // The same loose-in/canonical-out normalization the URL path goes through, so a code typed with or
      // without the printed "CFX-" prefix and dashes behaves identically to one that arrived as a link.
      const code = normalizeCertificateCode(input)
      if (code === null) {
        requestSeq.current += 1 // abandon anything in flight so it cannot overwrite this verdict
        setPhase({ kind: "error", reason: "badCode" })
        return
      }
      // Make the address bar a shareable permalink for the code just checked. REPLACE (not push) so the
      // browser Back button still leaves the page rather than walking back through typed codes.
      if (typeof window !== "undefined") {
        window.history.replaceState(window.history.state, "", serviceRecordPath(code))
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
      window.history.replaceState(window.history.state, "", "/service-record/")
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

/** The "no code yet" state: the value prop plus a single input a verifier types the printed code into. */
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
          // 19 = the printed "CFX-XXXX-XXXX-XXXX" form; normalization strips the separators anyway.
          maxLength={19}
        />
        <Button type="submit" size="lg" disabled={value.trim().length === 0}>
          {t("verify")}
        </Button>
      </form>

      <Disclaimer />
    </div>
  )
}

/** The in-flight state. Deliberately quiet: the round trip is a single small GET. */
function CheckingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" aria-live="polite">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <p className="mt-3 text-token-15 text-ink-2">{label}</p>
    </div>
  )
}

/**
 * The verdict card for a code the server recognized: warm moss when the record stands, muted ink when
 * the holder withdrew it. Both print (see service-record.css); both carry the disclaimer, because both
 * confirm only the existence and totals of a record, never its individual activities.
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
        <Field label={t("hours")} value={formatHours(record.totalHours, locale)} />
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

/** One label/value pair in the summary grid. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-token-12 font-semibold uppercase tracking-wider text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-token-15 text-ink">{value}</dd>
    </div>
  )
}

/**
 * The document hash, so a verifier can confirm the PDF in front of them is byte-identical to the one
 * civfix issued. Copy is best-effort: the Clipboard API is unavailable on insecure origins and in some
 * embedded browsers, and the value stays selectable either way.
 */
function Fingerprint({ sha256 }: { sha256: string }) {
  const { t } = useT("web-service-record")
  const [copied, setCopied] = React.useState(false)

  // Clear the "Copied" flash, and cancel the timer if the page navigates away first.
  React.useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
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
          {copied && <span>{t("copied")}</span>}
        </button>
      </div>
    </div>
  )
}

/** The three failure verdicts. All three offer the same way out: check another code. */
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
      {/* The page keeps a real <h1> in every state; EmptyState's own title is an <h4>, which would
          leave this (publicly linkable) document headingless. */}
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

/**
 * The one sentence that defines what this page is: it confirms the RECORD, not its contents. Rendered on
 * every state (including the empty form) so it is never something a verifier only sees after a match.
 */
function Disclaimer() {
  const { t } = useT("web-service-record")
  return (
    <p className="sr-disclaimer mx-auto mt-6 max-w-md text-center text-token-13 text-ink-3">
      {t("disclaimer")}
    </p>
  )
}

/** Locale-aware medium date; an absent/unparseable timestamp renders as an em dash, never "Invalid Date". */
function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date)
  } catch {
    // An unsupported locale tag must not blank the verdict.
    return date.toISOString().slice(0, 10)
  }
}

/** Hours carry a fractional part (0.25h granularity in the ledger), so keep up to two decimals. */
function formatHours(hours: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(hours)
  } catch {
    return String(hours)
  }
}

/** Whole-number count (activities on the document). */
function formatCount(count: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale).format(count)
  } catch {
    return String(count)
  }
}
