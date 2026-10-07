import type { LucideIcon } from "lucide-react"

export interface ConsoleNavItem {
  id: string
  label: string
  icon: LucideIcon
  href: string
}

/** The narrow-screen tab bar fits five tabs; any further entries stay in the rail. */
export const MAX_BOTTOM_TABS = 5
