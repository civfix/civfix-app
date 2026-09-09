"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { OrgDonationSettingsDTO, OrgPaymentsStatusDTO } from "@civfix/shared"
import { MAX_REFUND_POLICY_TEXT, MAX_SUGGESTED_AMOUNTS } from "@civfix/shared"
import { useApi } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { fieldErrorsFrom } from "@/components/console/query-state"
import { ConsoleButton } from "@/components/console/button"
import { Field } from "@/components/console/forms/field"
import { TextInput, TextArea } from "@/components/console/forms/inputs"
import { ToggleRow } from "@/components/console/forms/toggle-row"
import { useConsoleToast } from "@/components/console/overlay/toast"

import { consoleKeys } from "../../console-keys"
import { useConsoleErrors } from "../../error-copy"
import { useConsoleFormat } from "../../format"

export interface DonationSettingsFormProps {
  orgId: string
  settings: OrgDonationSettingsDTO
  status: OrgPaymentsStatusDTO
  canManage: boolean
  onOpenAgreement: () => void
}

interface Blocker {
  id: string
  label: string
}

export function DonationSettingsForm({
  orgId,
  settings,
  status,
  canManage,
  onOpenAgreement,
}: DonationSettingsFormProps) {
  const { t } = useT("host-payments")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const format = useConsoleFormat()

  const [enabled, setEnabled] = useState(settings.enabled)
  const [sharingDefault, setSharingDefault] = useState(settings.donorSharingDefault)
  const [mission, setMission] = useState(settings.missionBlurb ?? "")
  const [designation, setDesignation] = useState(settings.designationNote ?? "")
  const [refundPolicy, setRefundPolicy] = useState(settings.refundPolicyText ?? "")
  const [minAmount, setMinAmount] = useState(String(settings.minAmountMinor / 100))
  const [maxAmount, setMaxAmount] = useState(String(settings.maxAmountMinor / 100))
  const [suggested, setSuggested] = useState(
    settings.suggestedAmountsMinor.map((value) => String(value / 100)).join(", "),
  )
  const [fields, setFields] = useState<Record<string, string>>({})

  useEffect(() => {
    setEnabled(settings.enabled)
  }, [settings.enabled])

  const eligibilityOk =
    settings.eligibility.verdict === "eligible" || settings.eligibility.verdict === "grace"
  const accountOk = status.state === "ready" || status.state === "at_risk"
  const operatorLocked = status.donationsDisabledReason === "operator"

  const blockers: Blocker[] = [
    ...(accountOk ? [] : [{ id: "account", label: t("settings.blocker_account") }]),
    ...(eligibilityOk ? [] : [{ id: "eligibility", label: t("settings.blocker_eligibility") }]),
    ...(settings.agreement.current ? [] : [{ id: "agreement", label: t("settings.blocker_agreement") }]),
    ...(operatorLocked ? [{ id: "operator", label: t("settings.blocker_operator") }] : []),
  ]
  const canEnable = blockers.length === 0

  const save = useMutation({
    mutationFn: () => {
      const toMinor = (value: string) => Math.round(Number(value) * 100)
      return api.updateOrgDonationSettings({
        id: orgId,
        enabled,
        donorSharingDefault: sharingDefault,
        missionBlurb: mission.trim() === "" ? null : mission.trim(),
        designationNote: designation.trim() === "" ? null : designation.trim(),
        refundPolicyText: refundPolicy.trim() === "" ? null : refundPolicy.trim(),
        minAmountMinor: toMinor(minAmount),
        maxAmountMinor: toMinor(maxAmount),
        suggestedAmountsMinor: suggested
          .split(",")
          .map((part) => part.trim())
          .filter((part) => part.length > 0)
          .map(toMinor)
          .filter((value) => Number.isFinite(value) && value > 0)
          .slice(0, MAX_SUGGESTED_AMOUNTS),
      })
    },
    onSuccess: (res) => {
      toast.toast({ title: t("settings.saved"), tone: "success" })
      setFields({})
      qc.setQueryData(consoleKeys.orgDonationSettings(orgId), res)
      void qc.invalidateQueries({ queryKey: consoleKeys.orgPayments(orgId) })
    },
    onError: (err) => {
      setFields(fieldErrorsFrom(err))
      toast.toast({
        title: errors.message(err, {
          PAYMENT_UNAVAILABLE: t("settings.enable_unavailable"),
          FORBIDDEN: t("settings.operator_locked"),
        }),
        tone: "danger",
      })
    },
  })

  return (
    <section
      aria-labelledby="donation-settings"
      className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1"
    >
      <h2
        id="donation-settings"
        className="mb-token-3 font-display text-token-16 font-bold text-console-ink"
      >
        {t("settings.title")}
      </h2>

      <ToggleRow
        label={t("settings.enable")}
        caption={t("settings.enable_caption")}
        checked={enabled}
        locked={!canManage || !canEnable}
        lockedReason={
          !canManage
            ? t("settings.owner_only")
            : blockers.map((blocker) => blocker.label).join(" · ")
        }
        onChange={setEnabled}
      />

      {blockers.length > 0 ? (
        <ul className="mt-token-2 flex flex-col gap-token-1">
          {blockers.map((blocker) => (
            <li key={blocker.id} className="flex items-center gap-token-2 text-token-13 text-console-sun-strong">
              <span className="min-w-0 flex-1">{blocker.label}</span>
              {blocker.id === "agreement" ? (
                <button
                  type="button"
                  onClick={onOpenAgreement}
                  className="rounded-xs font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-console-ring"
                >
                  {t("settings.review_agreement")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="mt-token-4 grid gap-token-3 sm:grid-cols-2">
        <div>
          <dt className="text-token-12 text-console-ink-3">{t("settings.legal_name")}</dt>
          <dd className="text-token-13 text-console-ink">{settings.legalName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-token-12 text-console-ink-3">{t("settings.ein")}</dt>
          <dd className="text-token-13 text-console-ink">
            {settings.einLast4 ? `••• ${settings.einLast4}` : "—"}
          </dd>
        </div>
      </dl>

      <p className="mt-token-3 rounded-sm border border-console-line bg-console-tint px-token-3 py-token-2 text-token-12 text-console-ink-2">
        {t("settings.fee_disclosure", {
          percent: (settings.effectiveFeeBps / 100).toFixed(settings.effectiveFeeBps % 100 === 0 ? 0 : 2),
        })}
      </p>

      <div className="mt-token-4 flex flex-col gap-token-4">
        <Field
          label={t("settings.mission")}
          htmlFor="donation-mission"
          optional
          counter={`${mission.length}/280`}
          error={fields.missionBlurb}
        >
          <TextArea
            id="donation-mission"
            value={mission}
            maxLength={280}
            disabled={!canManage}
            onChange={(event) => setMission(event.target.value)}
          />
        </Field>

        <Field
          label={t("settings.designation")}
          htmlFor="donation-designation"
          optional
          counter={`${designation.length}/280`}
          error={fields.designationNote}
        >
          <TextArea
            id="donation-designation"
            value={designation}
            maxLength={280}
            disabled={!canManage}
            onChange={(event) => setDesignation(event.target.value)}
          />
        </Field>

        <Field
          label={t("settings.refund_policy")}
          htmlFor="donation-refund"
          optional
          hint={t("settings.refund_policy_hint")}
          counter={`${refundPolicy.length}/${MAX_REFUND_POLICY_TEXT}`}
          error={fields.refundPolicyText ? t("settings.refund_policy_error") : undefined}
        >
          <TextArea
            id="donation-refund"
            value={refundPolicy}
            maxLength={MAX_REFUND_POLICY_TEXT}
            disabled={!canManage}
            onChange={(event) => setRefundPolicy(event.target.value)}
          />
        </Field>

        <div className="grid gap-token-3 sm:grid-cols-2">
          <Field
            label={t("settings.min_amount")}
            htmlFor="donation-min"
            error={fields.minAmountMinor}
          >
            <TextInput
              id="donation-min"
              type="number"
              min={1}
              step="0.01"
              value={minAmount}
              disabled={!canManage}
              onChange={(event) => setMinAmount(event.target.value)}
            />
          </Field>
          <Field
            label={t("settings.max_amount")}
            htmlFor="donation-max"
            error={fields.maxAmountMinor}
          >
            <TextInput
              id="donation-max"
              type="number"
              min={1}
              step="0.01"
              value={maxAmount}
              disabled={!canManage}
              onChange={(event) => setMaxAmount(event.target.value)}
            />
          </Field>
        </div>

        <Field
          label={t("settings.suggested")}
          htmlFor="donation-suggested"
          hint={t("settings.suggested_hint", { max: MAX_SUGGESTED_AMOUNTS })}
          error={fields.suggestedAmountsMinor}
        >
          <TextInput
            id="donation-suggested"
            value={suggested}
            disabled={!canManage}
            onChange={(event) => setSuggested(event.target.value)}
          />
        </Field>

        <ToggleRow
          label={t("settings.sharing_default")}
          caption={t("settings.sharing_default_caption")}
          checked={sharingDefault}
          locked={!canManage}
          lockedReason={t("settings.owner_only")}
          onChange={setSharingDefault}
        />
      </div>

      <div className="mt-token-4 flex items-center justify-between gap-token-3">
        <p className="text-token-12 text-console-ink-3">
          {t("settings.current_range", {
            min: format.money(settings.minAmountMinor),
            max: format.money(settings.maxAmountMinor),
          })}
        </p>
        <ConsoleButton disabled={!canManage || save.isPending} onClick={() => save.mutate()}>
          {tc("action.save")}
        </ConsoleButton>
      </div>
    </section>
  )
}
