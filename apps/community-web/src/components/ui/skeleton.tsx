import { cn } from "@/lib/utils"

/**
 * Loading placeholder block. Uses a paper2-tinted pulse so it reads on the white card surface.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-sm bg-paper2", className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export { Skeleton }
