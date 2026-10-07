"use client"

import { CircleAlert, Lock, SearchX, WifiOff } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

import { ConsoleButton } from "./button"

export type SkeletonShape = "text" | "row" | "card" | "kpi" | "chart"

const SKELETON_SHAPES: Record<SkeletonShape, string> = {
  text: "h-4 w-full rounded-xs",
  row: "h-11 w-full rounded-sm",
  card: "h-24 w-full rounded-md",
  kpi: "h-20 w-full rounded-md",
  chart: "h-48 w-full rounded-md",
}

export function Skeleton({
  shape = "text",
  className,
}: {
  shape?: SkeletonShape
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "block animate-pulse bg-console-surface-alt",
        SKELETON_SHAPES[shape],
        className,
      )}
    />
  )
}

export function LoadingState({
  shape = "row",
  count = 5,
  className,
}: {
  shape?: SkeletonShape
  count?: number
  className?: string
}) {
  const { t } = useT("host-common")
  return (
    <div role="status" className={cn("flex flex-col gap-token-2", className)}>
      <span className="sr-only">{t("state.loading")}</span>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} shape={shape} />
      ))}
    </div>
  )
}

const NEUTRAL_ICON_TONE = "bg-console-surface-alt text-console-ink-3"

function StateHeading({
  icon: Icon,
  iconTone,
  title,
  titleSize,
  body,
}: {
  icon: LucideIcon
  iconTone: string
  title: string
  titleSize: "text-token-15" | "text-token-16"
  body?: string
}) {
  return (
    <>
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-pill", iconTone)}>
        <Icon aria-hidden className="h-5 w-5" />
      </span>
      <p className={`font-display ${titleSize} font-bold text-console-ink`}>{title}</p>
      {body ? <p className="max-w-sm text-token-13 text-console-ink-3">{body}</p> : null}
    </>
  )
}

export type EmptyTone = "neutral" | "sun" | "moss" | "bloom" | "sky" | "lilac"

const EMPTY_TONE_CLASSES: Record<EmptyTone, string> = {
  neutral: NEUTRAL_ICON_TONE,
  sun: "bg-console-sun-soft text-console-sun-strong",
  moss: "bg-console-moss-soft text-console-moss-strong",
  bloom: "bg-console-bloom-soft text-console-bloom-strong",
  sky: "bg-console-sky-soft text-console-sky-strong",
  lilac: "bg-console-lilac-soft text-console-lilac-strong",
}

export interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  body?: string
  tone?: EmptyTone
  variant?: "none" | "filtered"
  cta?: { label: string; onPress: () => void }
  onClearFilters?: () => void
  className?: string
}

export function EmptyState({
  icon,
  title,
  body,
  tone = "neutral",
  variant = "none",
  cta,
  onClearFilters,
  className,
}: EmptyStateProps) {
  const { t } = useT("host-common")
  const resolvedTitle =
    title ?? (variant === "filtered" ? t("state.empty_filtered_title") : t("state.empty_title"))
  const resolvedBody =
    body ?? (variant === "filtered" ? t("state.empty_filtered_body") : undefined)
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-token-2 rounded-md border border-dashed border-console-line bg-console-surface-alt/50 px-token-6 py-token-8 text-center",
        className,
      )}
    >
      <StateHeading
        icon={icon ?? (variant === "filtered" ? SearchX : CircleAlert)}
        iconTone={EMPTY_TONE_CLASSES[tone]}
        title={resolvedTitle}
        titleSize="text-token-15"
        body={resolvedBody}
      />
      {variant === "filtered" || cta ? (
        <div className="mt-token-1 flex items-center gap-token-2">
          {variant === "filtered" && onClearFilters ? (
            <ConsoleButton variant="outline" size="sm" onClick={onClearFilters}>
              {t("action.clear_filters")}
            </ConsoleButton>
          ) : null}
          {cta ? (
            <ConsoleButton size="sm" onClick={cta.onPress}>
              {cta.label}
            </ConsoleButton>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function ErrorRegion({
  title,
  body,
  onRetry,
  className,
}: {
  title?: string
  body?: string
  onRetry?: () => void
  className?: string
}) {
  const { t } = useT("host-common")
  return (
    <div
      role="alert"
      className={cn(
        "flex items-center gap-token-3 rounded-sm border border-console-bloom-strong/30 bg-console-bloom-soft px-token-4 py-token-3",
        className,
      )}
    >
      <CircleAlert aria-hidden className="h-4 w-4 shrink-0 text-console-bloom-strong" />
      <div className="min-w-0 flex-1">
        <p className="text-token-13 font-bold text-console-bloom-strong">
          {title ?? t("state.error_title")}
        </p>
        <p className="text-token-12 text-console-ink-2">{body ?? t("state.error_body")}</p>
      </div>
      {onRetry ? (
        <ConsoleButton variant="outline" size="sm" onClick={onRetry} className="shrink-0">
          {t("action.retry")}
        </ConsoleButton>
      ) : null}
    </div>
  )
}

interface ExitStateProps {
  title?: string
  body?: string
  exitLabel?: string
  onExit?: () => void
  className?: string
}

function ExitState({
  icon,
  title,
  body,
  exitLabel,
  exitVariant,
  onExit,
  className,
}: {
  icon: LucideIcon
  title: string
  body: string
  exitLabel?: string
  exitVariant?: "outline"
  onExit?: () => void
  className?: string
}) {
  const { t } = useT("host-common")
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-token-2 rounded-md border border-console-line bg-console-surface px-token-6 py-token-10 text-center shadow-console-1",
        className,
      )}
    >
      <StateHeading
        icon={icon}
        iconTone={NEUTRAL_ICON_TONE}
        title={title}
        titleSize="text-token-16"
        body={body}
      />
      {onExit ? (
        <ConsoleButton variant={exitVariant} size="sm" onClick={onExit} className="mt-token-1">
          {exitLabel ?? t("action.back_to_events")}
        </ConsoleButton>
      ) : null}
    </div>
  )
}

export function NoAccessState({ title, body, ...rest }: ExitStateProps) {
  const { t } = useT("host-common")
  return (
    <ExitState
      icon={Lock}
      title={title ?? t("state.no_access_title")}
      body={body ?? t("state.no_access_body")}
      {...rest}
    />
  )
}

export function NotFoundState({ title, body, ...rest }: ExitStateProps) {
  const { t } = useT("host-common")
  return (
    <ExitState
      icon={SearchX}
      title={title ?? t("state.not_found_title")}
      body={body ?? t("state.not_found_body")}
      exitVariant="outline"
      {...rest}
    />
  )
}

function OfflineState({
  title,
  body,
  onRetry,
  retryLabel,
  className,
}: {
  title?: string
  body?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}) {
  const { t } = useT("host-common")
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-token-2 rounded-md border border-dashed border-console-sun-strong/40 bg-console-sun-soft/60 px-token-6 py-token-8 text-center",
        className,
      )}
    >
      <StateHeading
        icon={WifiOff}
        iconTone="bg-console-sun-soft text-console-sun-strong"
        title={title ?? t("state.offline_title")}
        titleSize="text-token-15"
        body={body ?? t("state.offline_body")}
      />
      {onRetry ? (
        <ConsoleButton variant="outline" size="sm" onClick={onRetry} className="mt-token-1">
          {retryLabel ?? t("action.retry")}
        </ConsoleButton>
      ) : null}
    </div>
  )
}

export interface StateGateProps {
  loading?: boolean
  error?: boolean
  offline?: boolean
  forbidden?: boolean
  notFound?: boolean
  empty?: boolean
  onRetry?: () => void
  skeleton?: ReactNode
  errorState?: ReactNode
  offlineState?: ReactNode
  forbiddenState?: ReactNode
  notFoundState?: ReactNode
  emptyState?: ReactNode
  children: ReactNode
}

export function StateGate({
  loading,
  error,
  offline,
  forbidden,
  notFound,
  empty,
  onRetry,
  skeleton,
  errorState,
  offlineState,
  forbiddenState,
  notFoundState,
  emptyState,
  children,
}: StateGateProps) {
  if (loading) return <>{skeleton ?? <LoadingState />}</>
  if (offline) return <>{offlineState ?? <OfflineState onRetry={onRetry} />}</>
  if (forbidden) return <>{forbiddenState ?? <NoAccessState />}</>
  if (notFound) return <>{notFoundState ?? <NotFoundState />}</>
  if (error) return <>{errorState ?? <ErrorRegion onRetry={onRetry} />}</>
  if (empty) return <>{emptyState ?? <EmptyState />}</>
  return <>{children}</>
}
