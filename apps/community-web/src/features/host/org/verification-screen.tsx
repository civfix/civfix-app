"use client"

import { useMemo, useState } from "react"
import { BadgeCheck, Ban, Hourglass, ShieldQuestion } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { OrgVerificationKind, OrganizationVerificationDTO } from "@civfix/shared"
import {
  ApplyOrganizationVerificationRequestSchema,
  MAX_ORG_VERIFICATION_DOCUMENTS,
} from "@civfix/shared"
import { useApi } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { useGate, fieldErrorsFrom } from "@/components/console/query-state"
import { LoadingState, StateGate } from "@/components/console/states"
import { ConsoleButton } from "@/components/console/button"
import { Chip } from "@/components/console/chips/chip"
import { Field } from "@/components/console/forms/field"
import { TextInput, TextArea } from "@/components/console/forms/inputs"
import { SegmentedControl } from "@/components/console/forms/segmented-control"
import { ErrorSummary } from "@/components/console/forms/error-summary"
import type { FieldError } from "@/components/console/forms/error-summary"
import { GalleryField } from "@/components/console/forms/image-upload"
import type { ConsoleImage } from "@/components/console/forms/image-upload"
import { ConfirmModal } from "@/components/console/overlay/confirm-modal"
import { useConsoleToast } from "@/components/console/overlay/toast"

import { useConsoleOrg } from "../console-context"
import { useConsoleErrors } from "../error-copy"
import { useConsoleFormat } from "../format"
import { consoleKeys } from "../console-keys"
import { invalidateOrg } from "../console-invalidate"
import { suspendedForbiddenCopy } from "./suspended-banner"

const KINDS: readonly OrgVerificationKind[] = ["nonprofit", "government", "community"]
const MAX_NOTE = 1000

/** Accepts "12-3456789" and "123456789"; the contract regex, mirrored so the hint and the check agree. */
export const EIN_PATTERN = /^\d{2}-?\d{7}$/

export function normalizeEin(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 9)
  return digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits
}

export function useOrgVerification(orgId: string, enabled = true) {
  const api = useApi()
  return useQuery<OrganizationVerificationDTO>({
    queryKey: consoleKeys.orgVerification(orgId),
    enabled,
    queryFn: () => api.getOrganizationVerification({ id: orgId }),
    retry: false,
  })
}

function StatusPanel({
  verification,
  onReapply,
  reapplying,
}: {
  verification: OrganizationVerificationDTO
  onReapply: () => void
  reapplying: boolean
}) {
  const { t } = useT("host-org")
  const format = useConsoleFormat()
  const { status } = verification

  const Icon =
    status === "verified"
      ? BadgeCheck
      : status === "pending"
        ? Hourglass
        : status === "rejected"
          ? Ban
          : ShieldQuestion
  const tone =
    status === "verified"
      ? "bg-console-moss-soft text-console-moss-strong"
      : status === "pending"
        ? "bg-console-sun-soft text-console-sun-strong"
        : status === "rejected"
          ? "bg-console-bloom-soft text-console-bloom-strong"
          : "bg-console-surface-alt text-console-ink-3"

  const title =
    status === "verified"
      ? t("verification.verified_title", { defaultValue: "This organization is verified" })
      : status === "pending"
        ? t("verification.pending_title", { defaultValue: "Application under review" })
        : status === "rejected"
          ? t("verification.rejected_title", { defaultValue: "Application not approved" })
          : t("verification.unverified_title", { defaultValue: "Not yet verified" })

  const body =
    status === "verified"
      ? t("verification.verified_body", {
          defaultValue:
            "Your events carry a verified badge people can trust.",
        })
      : status === "pending"
        ? t("verification.pending_body", {
            defaultValue:
              "We are reviewing your documents. We will notify you as soon as there is a decision - usually within a few business days.",
          })
        : status === "rejected"
          ? t("verification.rejected_body", {
              defaultValue:
                "Review the reason below, fix what is missing, and apply again with updated documents.",
            })
          : t("verification.unverified_body", {
              defaultValue:
                "Verification adds a badge to your events. Tell us what kind of organization you are and attach proof.",
            })

  return (
    <section className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1">
      <div className="flex items-start gap-token-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-pill ${tone}`}>
          <Icon aria-hidden className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-token-2">
            <h2 className="font-display text-token-16 font-bold text-console-ink">{title}</h2>
            <Chip kind="org-verification" value={status} size="sm" />
            {verification.kind ? <Chip kind="org-kind" value={verification.kind} size="sm" /> : null}
          </div>
          <p className="mt-token-1 text-token-13 text-console-ink-2">{body}</p>
          <dl className="mt-token-3 flex flex-wrap gap-x-token-5 gap-y-token-2 text-token-12">
            {verification.submittedAt ? (
              <div>
                <dt className="text-console-ink-3">
                  {t("verification.submitted", { defaultValue: "Submitted" })}
                </dt>
                <dd className="font-semibold text-console-ink-2">
                  {format.dateTime(verification.submittedAt)}
                </dd>
              </div>
            ) : null}
            {verification.reviewedAt ? (
              <div>
                <dt className="text-console-ink-3">
                  {t("verification.reviewed", { defaultValue: "Reviewed" })}
                </dt>
                <dd className="font-semibold text-console-ink-2">
                  {format.dateTime(verification.reviewedAt)}
                </dd>
              </div>
            ) : null}
          </dl>
          {status === "rejected" ? (
            <div
              role="status"
              className="mt-token-3 rounded-sm border border-console-bloom-strong/30 bg-console-bloom-soft px-token-3 py-token-2 text-token-13 text-console-ink"
            >
              <span className="font-semibold text-console-bloom-strong">
                {t("verification.reason", { defaultValue: "Reason" })}:{" "}
              </span>
              {verification.rejectionReason ??
                t("verification.no_reason", { defaultValue: "No reason was given." })}
            </div>
          ) : null}
          {status === "rejected" && !reapplying ? (
            <ConsoleButton size="sm" className="mt-token-3" onClick={onReapply}>
              {t("verification.reapply", { defaultValue: "Apply again" })}
            </ConsoleButton>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function ApplyForm({ orgId, onSubmitted }: { orgId: string; onSubmitted: () => void }) {
  const { t } = useT("host-org")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const { isSuspended } = useConsoleOrg()

  const [kind, setKind] = useState<OrgVerificationKind>("nonprofit")
  const [ein, setEin] = useState("")
  const [documents, setDocuments] = useState<ConsoleImage[]>([])
  const [note, setNote] = useState("")
  const [serverFields, setServerFields] = useState<Record<string, string>>({})
  const [submitCount, setSubmitCount] = useState(0)
  const [confirming, setConfirming] = useState(false)

  const body = useMemo(
    () => ({
      id: orgId,
      kind,
      ...(kind === "nonprofit" && ein.trim() !== "" ? { einNumber: ein.trim() } : {}),
      documents: documents.map((doc) => ({ mediaId: doc.mediaId })),
      ...(note.trim() !== "" ? { note: note.trim() } : {}),
    }),
    [documents, ein, kind, note, orgId],
  )

  const localErrors = useMemo(() => {
    const out: Record<string, string> = {}
    const parsed = ApplyOrganizationVerificationRequestSchema.safeParse(body)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form")
        if (!out[key]) out[key] = issue.message
      }
    }
    if (out.einNumber) {
      out.einNumber = t("verification.ein_invalid", {
        defaultValue: "Enter the 9-digit EIN as XX-XXXXXXX.",
      })
    }
    if (documents.length === 0 && kind !== "community") {
      out.documents = t("verification.documents_required", {
        defaultValue: "Attach at least one document.",
      })
    }
    return out
  }, [body, documents.length, kind, t])

  const fieldErrors = { ...localErrors, ...serverFields }
  const summary: FieldError[] = Object.entries(fieldErrors).map(([key, message]) => ({
    id: `verification-${key}`,
    message: `${t(`verification.field_${key}`, { defaultValue: key })}: ${message}`,
  }))

  const apply = useMutation({
    mutationFn: () => api.applyOrganizationVerification(body),
    onSuccess: (result) => {
      toast.toast({
        title: t("verification.submitted_toast", { defaultValue: "Application submitted" }),
        tone: "success",
      })
      setConfirming(false)
      setServerFields({})
      qc.setQueryData(consoleKeys.orgVerification(orgId), result)
      invalidateOrg(qc, orgId)
      onSubmitted()
    },
    onError: (err) => {
      setConfirming(false)
      setServerFields(fieldErrorsFrom(err))
      setSubmitCount((count) => count + 1)
      toast.toast({
        title: errors.message(err, isSuspended ? { FORBIDDEN: suspendedForbiddenCopy(t) } : {}),
        tone: "danger",
      })
    },
  })

  const submit = () => {
    if (isSuspended) return
    setSubmitCount((count) => count + 1)
    if (Object.keys(localErrors).length > 0) return
    setConfirming(true)
  }

  const showError = (key: string) => (submitCount > 0 ? fieldErrors[key] : undefined)

  return (
    <form
      noValidate
      className="flex flex-col gap-token-5"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <ErrorSummary errors={submitCount > 0 ? summary : []} submitCount={submitCount} />

      <section className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1">
        <h2 className="mb-token-4 font-display text-token-16 font-bold text-console-ink">
          {t("verification.apply_title", { defaultValue: "Apply for verification" })}
        </h2>
        <div className="flex flex-col gap-token-4">
          <Field
            label={t("verification.field_kind", { defaultValue: "Organization type" })}
            hint={
              kind === "nonprofit"
                ? t("verification.kind_nonprofit_hint", {
                    defaultValue:
                      "A registered 501(c)(3) or similar.",
                  })
                : kind === "government"
                  ? t("verification.kind_government_hint", {
                      defaultValue: "A city, county, state or federal agency or department.",
                    })
                  : t("verification.kind_community_hint", {
                      defaultValue:
                        "A neighborhood council, school club, mutual-aid group or other informal group.",
                    })
            }
          >
            <SegmentedControl
              label={t("verification.field_kind", { defaultValue: "Organization type" })}
              value={kind}
              onChange={setKind}
              options={KINDS.map((value) => ({
                value,
                label: t(`enums:orgVerificationKind.${value}`),
              }))}
            />
          </Field>

          {kind === "nonprofit" ? (
            <Field
              label={t("verification.field_einNumber", { defaultValue: "EIN" })}
              htmlFor="verification-ein"
              optional
              hint={t("verification.ein_hint", {
                defaultValue: "Format XX-XXXXXXX. Speeds up review.",
              })}
              error={showError("einNumber")}
            >
              <TextInput
                id="verification-ein"
                inputMode="numeric"
                placeholder="12-3456789"
                maxLength={10}
                value={ein}
                invalid={Boolean(showError("einNumber"))}
                onChange={(event) => setEin(normalizeEin(event.target.value))}
                className="max-w-xs"
              />
            </Field>
          ) : null}

          <Field
            label={t("verification.field_documents", { defaultValue: "Documents" })}
            optional={kind === "community"}
            hint={t("verification.documents_hint", {
              max: MAX_ORG_VERIFICATION_DOCUMENTS,
              defaultValue: `Photos or scans (images) of your IRS determination letter, charter, letterhead or a government ID card - up to ${MAX_ORG_VERIFICATION_DOCUMENTS}. Only our reviewers see them.`,
            })}
            error={showError("documents")}
          >
            <GalleryField
              values={documents}
              onChange={setDocuments}
              max={MAX_ORG_VERIFICATION_DOCUMENTS}
              disabled={apply.isPending}
            />
          </Field>

          <Field
            label={t("verification.field_note", { defaultValue: "Note for the reviewer" })}
            htmlFor="verification-note"
            optional
            counter={`${note.length}/${MAX_NOTE}`}
            error={showError("note")}
          >
            <TextArea
              id="verification-note"
              rows={4}
              maxLength={MAX_NOTE}
              value={note}
              placeholder={t("verification.note_placeholder", {
                defaultValue: "Anything that helps us match the documents to this organization.",
              })}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
        </div>
      </section>

      <div className="flex justify-end">
        <ConsoleButton
          type="submit"
          disabled={apply.isPending || isSuspended}
          title={isSuspended ? suspendedForbiddenCopy(t) : undefined}
        >
          {t("verification.submit", { defaultValue: "Submit for review" })}
        </ConsoleButton>
      </div>

      <ConfirmModal
        open={confirming}
        severity="neutral"
        title={t("verification.confirm_title", { defaultValue: "Submit for review?" })}
        body={t("verification.confirm_body", {
          kind: t(`enums:orgVerificationKind.${kind}`),
          count: documents.length,
          defaultValue: `You are applying as a ${kind} organization with ${documents.length} document${documents.length === 1 ? "" : "s"}. You will not be able to edit the application while it is under review.`,
        })}
        confirmLabel={t("verification.submit", { defaultValue: "Submit for review" })}
        cancelLabel={tc("action.cancel")}
        busy={apply.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => apply.mutate()}
      />
    </form>
  )
}

export function VerificationScreen() {
  const { orgId } = useConsoleOrg()
  const verification = useOrgVerification(orgId)
  const gate = useGate(verification)
  const [reapplying, setReapplying] = useState(false)

  const data = verification.data
  const showForm = data ? data.status === "unverified" || (data.status === "rejected" && reapplying) : false

  return (
    <StateGate
      {...gate}
      onRetry={() => void verification.refetch()}
      skeleton={<LoadingState count={4} />}
    >
      {data ? (
        <div className="flex flex-col gap-token-5">
          <StatusPanel
            verification={data}
            reapplying={reapplying}
            onReapply={() => setReapplying(true)}
          />
          {showForm ? <ApplyForm orgId={orgId} onSubmitted={() => setReapplying(false)} /> : null}
        </div>
      ) : null}
    </StateGate>
  )
}
