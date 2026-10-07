import { cn } from "@/lib/utils"

/** paper2-tinted so the pulse reads on the white card surface. */
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
