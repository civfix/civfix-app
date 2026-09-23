import type { MetadataRoute } from "next"
import { tokens } from "@civfix/shared/tokens"
import {
  APPLE_TOUCH_ICON_PATH,
  APPLE_TOUCH_ICON_SIZES,
  BRAND_IMAGE_TYPE,
  DEFAULT_DESCRIPTION,
  ICON_PATH,
  ICON_TYPE,
  SITE_NAME,
} from "@/lib/site-meta"

export const dynamic = "force-static"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: tokens.color.neutral.paper,
    theme_color: tokens.color.neutral.paper,
    icons: [
      { src: ICON_PATH, sizes: "any", type: ICON_TYPE },
      { src: APPLE_TOUCH_ICON_PATH, sizes: APPLE_TOUCH_ICON_SIZES, type: BRAND_IMAGE_TYPE },
    ],
  }
}
