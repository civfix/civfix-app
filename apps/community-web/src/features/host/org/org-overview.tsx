"use client"

import { useState } from "react"
import { BadgeCheck, CalendarDays, Circle, CircleCheck, ExternalLink, Sparkles, UserPlus, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"
import { hrefForRoute } from "@/components/console/route"
import type { OrgSection } from "@/components/console/route"
import { useConsoleUrlState } from "@/components/console/url-state"
import { Chip } from "@/components/console/chips/chip"
import { KpiCell } from "@/components/console/charts"
import { ConsoleButton } from "@/components/console/button"
import { safeExternalHref } from "@/components/console/safe-url"

import { ConsoleLink } from "../layout/console-link"
import { useConsoleOrg } from "../console-context"
import { useConsoleFormat } from "../format"
import { publicOrgPath } from "./org-slug"
import { useOrgVerification } from "./verification-screen"

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

interface NextStep {
  id: string
  icon: LucideIcon
  title: string
  body: string
  done: boolean
  section: OrgSection
  /** Steps only an owner/admin can complete are hidden from plain members. */
  manage: boolean
}

export function OrgOverview() {
  const { t } = useT("host-org")
  const format = useConsoleFormat()
  const { org, orgId, canManage } = useConsoleOrg()
  const { params, set } = useConsoleUrlState()
  const verification = useOrgVerification(orgId, canManage)
  const status = verification.data?.status ?? org.verifiedStatus
  const [dismissed, setDismissed] = useState(false)

  const welcome = params.tab === "welcome"
  const memberCount = org.memberCount ?? 0
  const eventCount = org.eventCount ?? 0
  const website = safeExternalHref(org.websiteUrl)
  const donationLink = safeExternalHref(org.donationUrl)
  const donationHost = donationLink === null ? null : hostnameOf(donationLink)

  const allSteps: NextStep[] = [
    {
      id: "profile",
      icon: Sparkles,
      title: t("next.profile_title", { defaultValue: "Complete the profile" }),
      body: t("next.profile_body", {
        defaultValue: "Add a logo and a description so people recognize you on the public page.",
      }),
      done: Boolean(org.logoUrl) && Boolean(org.description),
      section: "settings",
      manage: true,
    },
    {
      id: "members",
      icon: UserPlus,
      title: t("next.members_title", { defaultValue: "Invite your team" }),
      body: t("next.members_body", {
        defaultValue: "Admins can run events and edit the profile; members see the roster.",
      }),
      done: memberCount > 1,
      section: "members",
      manage: true,
    },
    {
      id: "verification",
      icon: BadgeCheck,
      title: t("next.verification_title", { defaultValue: "Apply for verification" }),
      body: t("next.verification_body", {
        defaultValue: "A badge on every event you host.",
      }),
      done: status !== "unverified",
      section: "verification",
      manage: true,
    },
    {
      id: "events",
      icon: CalendarDays,
      title: t("next.events_title", { defaultValue: "Link an event" }),
      body: t("next.events_body", {
        defaultValue: "Open an event's Settings and pick this organization under Organization.",
      }),
      done: eventCount > 0,
      section: "events",
      manage: false,
    },
  ]
  const steps = allSteps.filter((step) => canManage || !step.manage)

  const doneCount = steps.filter((step) => step.done).length
  const allDone = doneCount === steps.length
  const showSteps = steps.length > 0 && !dismissed && (welcome || !allDone)

  return (
    <div className="flex flex-col gap-token-5">
      {showSteps ? (
        <section
          aria-labelledby="org-next-steps"
          className={cn(
            "rounded-md border p-token-4 shadow-console-1",
            welcome
              ? "border-console-lilac-strong/30 bg-console-lilac-soft"
              : "border-console-line bg-console-surface",
          )}
        >
          <div className="mb-token-3 flex flex-wrap items-start justify-between gap-token-2">
            <div>
              <h2 id="org-next-steps" className="font-display text-token-16 font-bold text-console-ink">
                {welcome
                  ? t("next.welcome_title", {
                      name: org.name,
                      defaultValue: `${org.name} is ready. Next steps:`,
                    })
                  : t("next.title", { defaultValue: "Next steps" })}
              </h2>
              <p className="text-token-12 text-console-ink-3">
                {t("next.progress", {
                  done: doneCount,
                  total: steps.length,
                  defaultValue: `${doneCount} of ${steps.length} done`,
                })}
              </p>
            </div>
            <ConsoleButton
              variant="ghost"
              size="sm"
              onClick={() => {
                setDismissed(true)
                if (welcome) set({ tab: null })
              }}
            >
              {t("next.dismiss", { defaultValue: "Hide" })}
            </ConsoleButton>
          </div>
          <ol className="grid gap-token-2 md:grid-cols-2">
            {steps.map((step) => {
              const Icon = step.done ? CircleCheck : Circle
              return (
                <li key={step.id}>
                  <ConsoleLink
                    href={hrefForRoute({ kind: "org", orgId, section: step.section })}
                    className={cn(
                      "flex h-full items-start gap-token-3 rounded-sm border border-console-line bg-console-surface px-token-3 py-token-3 transition-colors duration-d1 hover:bg-console-surface-alt focus-visible:outline-none focus-visible:shadow-console-ring",
                      step.done && "opacity-70",
                    )}
                  >
                    <Icon
                      aria-hidden
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        step.done ? "text-console-moss-strong" : "text-console-ink-3",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-token-2 text-token-14 font-semibold text-console-ink">
                        <step.icon aria-hidden className="h-4 w-4 text-console-ink-3" />
                        {step.title}
                      </span>
                      <span className="mt-0.5 block text-token-12 text-console-ink-3">{step.body}</span>
                    </span>
                    {step.done ? (
                      <span className="sr-only">{t("next.done", { defaultValue: "Done" })}</span>
                    ) : null}
                  </ConsoleLink>
                </li>
              )
            })}
          </ol>
        </section>
      ) : null}

      <section aria-labelledby="org-stats">
        <h2 id="org-stats" className="sr-only">
          {t("overview.title")}
        </h2>
        <div className="grid grid-cols-2 gap-token-3 lg:grid-cols-4">
          <KpiCell label={t("overview.events")} value={format.number(eventCount)} />
          <KpiCell label={t("overview.members")} value={format.number(memberCount)} />
          <KpiCell
            label={t("overview.verification", { defaultValue: "Verification" })}
            value={
              <span className="flex flex-wrap items-center gap-token-1">
                <Chip kind="org-verification" value={status} size="sm" />
                {org.verifiedKind ? <Chip kind="org-kind" value={org.verifiedKind} size="sm" /> : null}
              </span>
            }
            sub={org.verifiedAt ? format.date(org.verifiedAt) : undefined}
          />
          <KpiCell
            label={t("overview.donation_link")}
            value={
              donationLink === null ? (
                <span className="text-token-14 text-console-ink-3">
                  {t("overview.no_donation_link")}
                </span>
              ) : (
                <a
                  href={donationLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-xs text-token-14 font-semibold text-console-sky-strong underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-console-ring"
                >
                  {donationHost}
                  <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                </a>
              )
            }
            sub={
              canManage ? (
                <ConsoleLink
                  href={hrefForRoute({ kind: "org", orgId, section: "settings" })}
                  className="rounded-xs font-semibold text-console-sky-strong underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-console-ring"
                >
                  {donationLink === null
                    ? t("overview.add_donation_link")
                    : t("overview.edit_donation_link")}
                </ConsoleLink>
              ) : undefined
            }
          />
        </div>
      </section>

      <section className="grid gap-token-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1">
          <div className="mb-token-3 flex flex-wrap items-center justify-between gap-token-2">
            <h2 className="font-display text-token-16 font-bold text-console-ink">
              {t("overview.about", { defaultValue: "About" })}
            </h2>
            {canManage ? (
              <ConsoleLink
                href={hrefForRoute({ kind: "org", orgId, section: "settings" })}
                className="rounded-xs text-token-13 font-semibold text-console-sky-strong underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-console-ring"
              >
                {t("overview.edit", { defaultValue: "Edit profile" })}
              </ConsoleLink>
            ) : null}
          </div>
          <div className="flex items-start gap-token-4">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.logoUrl}
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 rounded-md bg-console-surface-alt object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              {org.description ? (
                <p className="whitespace-pre-line text-token-13 text-console-ink-2">{org.description}</p>
              ) : (
                <p className="text-token-13 text-console-ink-3">
                  {t("overview.no_description", {
                    defaultValue: "No description yet. Tell people what this organization does.",
                  })}
                </p>
              )}
              {website ? (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-token-2 inline-flex max-w-full items-center gap-1 rounded-xs text-token-13 font-semibold text-console-sky-strong underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-console-ring"
                >
                  <span className="truncate">{org.websiteUrl}</span>
                  <ExternalLink aria-hidden className="h-3.5 w-3.5 shrink-0" />
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1">
          <h2 className="mb-token-3 font-display text-token-16 font-bold text-console-ink">
            {t("overview.public_title", { defaultValue: "Public page" })}
          </h2>
          <p className="text-token-13 text-console-ink-2">
            {t("overview.public_body", {
              defaultValue:
                "Anyone with the link sees your logo, description, links and verification badge.",
            })}
          </p>
          <a
            href={publicOrgPath(org.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-token-3 inline-flex items-center gap-1 rounded-xs text-token-13 font-semibold text-console-sky-strong underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-console-ring"
          >
            {`civfix.org${publicOrgPath(org.slug)}`}
            <ExternalLink aria-hidden className="h-3.5 w-3.5" />
          </a>
          <dl className="mt-token-4 grid grid-cols-2 gap-token-3 text-token-12">
            <div>
              <dt className="text-console-ink-3">{t("overview.created")}</dt>
              <dd className="font-semibold text-console-ink-2">{format.date(org.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-console-ink-3">
                {t("overview.your_role", { defaultValue: "Your role" })}
              </dt>
              <dd>
                {org.myRole ? <Chip kind="org-role" value={org.myRole} size="sm" /> : "—"}
              </dd>
            </div>
          </dl>
          <div className="mt-token-4 flex flex-wrap gap-token-2">
            <ConsoleLink
              href={hrefForRoute({ kind: "org", orgId, section: "members" })}
              className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-console-line bg-console-surface px-token-3 text-token-13 font-semibold text-console-ink transition-colors duration-d1 hover:bg-console-surface-alt focus-visible:outline-none focus-visible:shadow-console-ring"
            >
              <Users aria-hidden className="h-4 w-4" />
              {t("nav.members")}
            </ConsoleLink>
            <ConsoleLink
              href={hrefForRoute({ kind: "org", orgId, section: "events" })}
              className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-console-line bg-console-surface px-token-3 text-token-13 font-semibold text-console-ink transition-colors duration-d1 hover:bg-console-surface-alt focus-visible:outline-none focus-visible:shadow-console-ring"
            >
              <CalendarDays aria-hidden className="h-4 w-4" />
              {t("nav.events_section", { defaultValue: "Events" })}
            </ConsoleLink>
          </div>
        </div>
      </section>
    </div>
  )
}
