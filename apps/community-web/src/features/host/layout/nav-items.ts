import type { LucideIcon } from "lucide-react"

export interface ConsoleNavItem {
  id: string
  label: string
  icon: LucideIcon
  href: string
  badge?: number
}
