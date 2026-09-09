"use client"

export function ConsoleBootSkeleton() {
  return (
    <div className="flex min-h-screen w-full bg-console-canvas">
      <span
        aria-hidden
        className="hidden h-screen w-[232px] shrink-0 animate-pulse border-r border-console-line bg-console-surface md:block"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-token-4 p-token-5">
        <span aria-hidden className="h-8 w-64 animate-pulse rounded-sm bg-console-surface-alt" />
        <span aria-hidden className="h-24 w-full animate-pulse rounded-md bg-console-surface-alt" />
        <span aria-hidden className="h-64 w-full animate-pulse rounded-md bg-console-surface-alt" />
      </div>
    </div>
  )
}
