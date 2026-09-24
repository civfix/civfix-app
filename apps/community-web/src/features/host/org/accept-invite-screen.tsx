"use client"

import { useMemo, useState } from "react"
import { CircleAlert, MailOpen } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AcceptOrganizationInviteRequestSchema, ErrorCode } from "@civfix/shared"
import type { AcceptOrganizationInviteResponse } from "@civfix/shared"
import { useApi, useMyOrganizations } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { hrefForRoute } from "@/components/console/route"
import { ConsoleButton } from "@/components/console/button"
import { useConsoleToast } from "@/components/console/overlay/toast"
import { toAppError } from "@/lib/api"

import { ConsoleShell } from "../layout/console-shell"
import { Breadcrumbs } from "../layout/breadcrumbs"
import { useConsoleHomeNav } from "../layout/home-nav"
import { MAX_BOTTOM_TABS } from "../layout/nav-items"
import { useConsoleNavigation } from "../console-context"
import { useConsoleErrors } from "../error-copy"
import { invalidateOrg, upsertMyOrganization } from "../console-invalidate"
import { clearStashedInviteToken, readStashedInviteToken } from "./org-invites"

const JOINED_AS_COPY: Record<AcceptOrganizationInviteResponse["role"], string> = {
  owner: "You're the owner.",
  admin: "You're an admin.",
  member: "You're a member.",
}

export interface AcceptInviteScreenProps {
  /**
   * The token the URL carried when this page mounted; null when there was none, in which case a
   * stashed one is tried instead. Read once, at mount: the router strips the token from the URL
   * right after, and the page keeps the copy it took.
   */
  token: string | null
}

type Problem = "invalid" | "expired" | "wrong_email" | "other"

/**
 * The accept endpoint is the only read an invite has (the token identifies the org, DECISIONS §32),
 * so the page cannot name the organization before the host clicks - it explains what accepting
 * does, and the success toast + redirect to the org overview do the naming.
 */
export function AcceptInviteScreen({ token: routeToken }: AcceptInviteScreenProps) {
  const { t } = useT("host-org")
  const { t: tc } = useT("host-common")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const { go } = useConsoleNavigation()
  const orgs = useMyOrganizations()

  // Taken once at mount, URL first: a signed-out visit that went through an OAuth redirect comes
  // back without a URL token, and so does Back onto this page after the URL was stripped - then
  // the stash is tried, which a success or a dead token has already cleared.
  const [token] = useState(() => routeToken ?? readStashedInviteToken())
  const wellFormed = useMemo(
    () => token !== null && AcceptOrganizationInviteRequestSchema.safeParse({ token }).success,
    [token],
  )

  const [failure, setFailure] = useState<{ kind: Problem; message: string } | null>(null)
  // A missing or malformed token never reaches the API: it is the same "invalid" screen.
  const problem = failure ?? (wellFormed ? null : { kind: "invalid" as const, message: "" })

  const accept = useMutation({
    mutationFn: () => api.acceptOrganizationInvite({ token: token ?? "" }),
    onSuccess: (result: AcceptOrganizationInviteResponse) => {
      clearStashedInviteToken()
      toast.toast({
        title: t("accept.joined", {
          name: result.organization.name,
          defaultValue: `You joined ${result.organization.name}`,
        }),
        // `role` is the seated role: an owner who accepts an invite to their own org stays owner.
        description: t(`accept.joined_as_${result.role}`, {
          defaultValue: JOINED_AS_COPY[result.role],
        }),
        tone: "success",
      })
      // Seat the org in the list before the overview mounts, so it never reads as not found.
      upsertMyOrganization(qc, { ...result.organization, myRole: result.role })
      invalidateOrg(qc, result.organization.id)
      go({ kind: "org", orgId: result.organization.id, section: "overview" })
    },
    onError: (err) => {
      const code = toAppError(err).code
      const kind: Problem =
        code === ErrorCode.NOT_FOUND
          ? "invalid"
          : code === ErrorCode.CONFLICT
            ? "expired"
            : code === ErrorCode.FORBIDDEN
              ? "wrong_email"
              : "other"
      // A dead token is dead for good; a transient failure keeps it so a retry can work.
      if (kind !== "other") clearStashedInviteToken()
      setFailure({ kind, message: kind === "other" ? errors.message(err) : "" })
    },
  })

  const retry = () => {
    setFailure(null)
    accept.mutate()
  }

  // Walking away drops the stash too: otherwise every console boot would steer back here until
  // the tab closed. The emailed link still works - it carries the token itself.
  const leave = () => {
    clearStashedInviteToken()
    go({ kind: "portfolio" })
  }

  const navItems = useConsoleHomeNav(orgs.data, { portfolio: t("nav.events") })

  const title = t("accept.title", { defaultValue: "Organization invitation" })

  return (
    <ConsoleShell
      navItems={navItems}
      bottomTabs={navItems.slice(0, MAX_BOTTOM_TABS)}
      activeId={null}
      title={title}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: t("breadcrumb.events"), href: hrefForRoute({ kind: "portfolio" }) },
            { label: title },
          ]}
        />
      }
    >
      <div className="mx-auto w-full max-w-lg">
        {problem ? (
          <InviteProblem
            problem={problem.kind}
            message={problem.message}
            retry={problem.kind === "other" ? retry : undefined}
            onExit={leave}
          />
        ) : (
          <section
            aria-labelledby="org-invite-accept-title"
            className="flex flex-col items-center gap-token-3 rounded-md border border-console-line bg-console-surface px-token-6 py-token-8 text-center shadow-console-1"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-console-moss-soft text-console-moss-strong">
              <MailOpen aria-hidden className="h-6 w-6" />
            </span>
            <h2
              id="org-invite-accept-title"
              className="font-display text-token-18 font-bold text-console-ink"
            >
              {t("accept.heading", { defaultValue: "You've been invited to join an organization" })}
            </h2>
            <p className="max-w-sm text-token-13 text-console-ink-3">
              {t("accept.body", {
                defaultValue:
                  "Accepting adds you to its team: you'll see the organization's events and console, and you can host events under its name.",
              })}
            </p>
            <div className="mt-token-2 flex flex-wrap items-center justify-center gap-token-2">
              <ConsoleButton variant="ghost" onClick={leave}>
                {t("accept.not_now", { defaultValue: "Not now" })}
              </ConsoleButton>
              <ConsoleButton disabled={accept.isPending} onClick={() => accept.mutate()}>
                {accept.isPending
                  ? tc("action.loading")
                  : t("accept.action", { defaultValue: "Accept invitation" })}
              </ConsoleButton>
            </div>
          </section>
        )}
      </div>
    </ConsoleShell>
  )
}

function InviteProblem({
  problem,
  message,
  retry,
  onExit,
}: {
  problem: Problem
  message: string
  retry?: () => void
  onExit: () => void
}) {
  const { t } = useT("host-org")
  const { t: tc } = useT("host-common")
  const copy: Record<Problem, { title: string; body: string }> = {
    invalid: {
      title: t("accept.error_invalid_title", {
        defaultValue: "This invitation is invalid or was revoked",
      }),
      body: t("accept.error_invalid_body", {
        defaultValue:
          "Check that you're signed in with the email address the invitation was sent to, or ask the organization to send a new one.",
      }),
    },
    expired: {
      title: t("accept.error_expired_title", { defaultValue: "This invitation has expired" }),
      body: t("accept.error_expired_body", {
        defaultValue: "Ask the organization to send a new one.",
      }),
    },
    wrong_email: {
      title: t("accept.error_wrong_email_title", {
        defaultValue: "This invitation was sent to a different email",
      }),
      body: t("accept.error_wrong_email_body", {
        defaultValue: "Sign in with the address that received it, then open the link again.",
      }),
    },
    other: {
      title: message || tc("state.error_title"),
      body: t("accept.error_other_body", {
        defaultValue: "Nothing changed. You can try again.",
      }),
    },
  }
  const { title, body } = copy[problem]
  return (
    <section
      role="alert"
      data-testid="org-invite-problem"
      className="flex flex-col items-center gap-token-2 rounded-md border border-console-bloom-strong/30 bg-console-surface px-token-6 py-token-8 text-center shadow-console-1"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-console-bloom-soft text-console-bloom-strong">
        <CircleAlert aria-hidden className="h-6 w-6" />
      </span>
      <p className="font-display text-token-16 font-bold text-console-ink">{title}</p>
      <p className="max-w-sm text-token-13 text-console-ink-3">{body}</p>
      <div className="mt-token-2 flex flex-wrap items-center justify-center gap-token-2">
        <ConsoleButton variant="outline" size="sm" onClick={onExit}>
          {tc("action.back_to_events")}
        </ConsoleButton>
        {retry ? (
          <ConsoleButton size="sm" onClick={retry}>
            {tc("action.retry")}
          </ConsoleButton>
        ) : null}
      </div>
    </section>
  )
}
