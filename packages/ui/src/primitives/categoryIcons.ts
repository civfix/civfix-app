import type { ReportCategory } from "@civfix/shared"
import { iconMap } from "../typography"
import type { LucideIcon } from "../typography"

export const CATEGORY_ICONS: Record<ReportCategory, LucideIcon> = {
  trash: iconMap.Trash2,
  recycling: iconMap.Leaf,
  graffiti: iconMap.PaintBucket,
  hazard: iconMap.TriangleAlert,
  encampment: iconMap.Tent,
  water: iconMap.Droplet,
  other: iconMap.Ellipsis,
}
