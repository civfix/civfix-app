"use client"

import { useState } from "react"
import { Building2, ChevronsUpDown, Plus } from "lucide-react"
import { useMyOrganizations } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"
import { hrefForRoute } from "@/components/console/route"
import type { OrgSection } from "@/components/console/route"
import { Overlay } from "@/components/console/overlay/overlay"
import { LoadingState } from "@/components/console/states"
import { Chip } from "@/components/console/chips/chip"

import { ConsoleLink } from "./console-link"

export interface OrgSwitcherProps {
  /** The org currently open, or null on the portfolio / create screens. */
  orgId: string | null
  /** Keep the viewer on the same section when they switch orgs. */
  section?: OrgSection | null
  className?: string
}

export function OrgSwitcher({ orgId, section, className }: OrgSwitcherProps) {
  const { t } = useT("host-org")
  const [open, setOpen] = useState(false)
  const orgs = useMyOrganizations()
  const rows = orgs.data ?? []

  const hrefFor = (id: string) =>
    hrefForRoute({ kind: "org", orgId: id, section: section ?? "overview" })

  const label = t("switcher.label", { defaultValue: "Organizations" })

  return (
    <Overlay
      open={open}
      onClose={() => setOpen(false)}
      align="end"
      width={320}
      label={label}
      trigger={
        <button
          type="button"
          aria-expanded={open}
          // The overlay is a dialog holding a plain list of links, not a role=menu.
          aria-haspopup="dialog"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-sm border border-console-line bg-console-surface px-token-3 text-token-13 font-semibold text-console-ink-2 transition-colors duration-d1 hover:bg-console-surface-alt hover:text-console-ink focus-visible:outline-none focus-visible:shadow-console-ring",
            className,
          )}
        >
          <Building2 aria-hidden className="h-3.5 w-3.5" />
          {label}
          <ChevronsUpDown aria-hidden className="h-3.5 w-3.5" />
        </button>
      }
    >
      {orgs.isPending ? (
        <LoadingState count={3} />
      ) : (
        <ul className="flex flex-col">
          {rows.length === 0 ? (
            <li className="px-token-2 py-token-2 text-token-13 text-console-ink-3">
              {t("switcher.empty", { defaultValue: "You are not part of an organization yet." })}
            </li>
          ) : null}
          {rows.map((org) => (
            <li key={org.id}>
              <ConsoleLink
                href={hrefFor(org.id)}
                aria-current={org.id === orgId ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-11 items-center gap-token-3 rounded-xs px-token-2 py-1 text-token-13 transition-colors duration-d1 hover:bg-console-surface-alt focus-visible:outline-none focus-visible:shadow-console-ring",
                  org.id === orgId ? "text-console-ink" : "text-console-ink-2",
                )}
              >
                {org.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- static export: next/image cannot optimize
                  <img
                    src={org.logoUrl}
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 shrink-0 rounded-sm bg-console-surface-alt object-cover"
                  />
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-console-surface-alt text-console-ink-3">
                    <Building2 aria-hidden className="h-4 w-4" />
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{org.name}</span>
                  <span className="truncate text-token-12 text-console-ink-3">{`@${org.slug}`}</span>
                </span>
                {org.myRole ? <Chip kind="org-role" value={org.myRole} size="sm" /> : null}
              </ConsoleLink>
            </li>
          ))}
          <li className={cn(rows.length > 0 && "mt-token-1 border-t border-console-line pt-token-1")}>
            <ConsoleLink
              href={hrefForRoute({ kind: "org-new" })}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-token-3 rounded-xs px-token-2 py-1 text-token-13 font-semibold text-console-ink-2 transition-colors duration-d1 hover:bg-console-surface-alt hover:text-console-ink focus-visible:outline-none focus-visible:shadow-console-ring"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-dashed border-console-line-strong text-console-ink-3">
                <Plus aria-hidden className="h-4 w-4" />
              </span>
              {t("switcher.new", { defaultValue: "New organization" })}
            </ConsoleLink>
          </li>
        </ul>
      )}
    </Overlay>
  )
}
