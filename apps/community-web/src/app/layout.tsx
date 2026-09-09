import type { Metadata, Viewport } from "next"
import { tokens, darkColor } from "@civfix/shared/tokens"

import { Providers } from "@/components/providers"
import {
  APPLE_TOUCH_ICON_PATH,
  APPLE_TOUCH_ICON_SIZES,
  BRAND_IMAGE_HEIGHT,
  BRAND_IMAGE_PATH,
  BRAND_IMAGE_TYPE,
  BRAND_IMAGE_WIDTH,
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  ICON_PATH,
  ICON_TYPE,
  SITE_LOCALE,
  SITE_NAME,
  normalizeSiteUrl,
} from "@/lib/site-meta"
import "./globals.css"
import "@/styles/design.css"
import "@/styles/contract-fonts.css"


const siteOrigin = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  icons: {
    icon: [{ url: ICON_PATH, type: ICON_TYPE }],
    apple: [{ url: APPLE_TOUCH_ICON_PATH, sizes: APPLE_TOUCH_ICON_SIZES, type: BRAND_IMAGE_TYPE }],
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: BRAND_IMAGE_PATH,
        secureUrl: `${siteOrigin}${BRAND_IMAGE_PATH}`,
        type: BRAND_IMAGE_TYPE,
        width: BRAND_IMAGE_WIDTH,
        height: BRAND_IMAGE_HEIGHT,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: BRAND_IMAGE_PATH, alt: SITE_NAME }],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: tokens.color.neutral.paper },
    { media: "(prefers-color-scheme: dark)", color: darkColor.neutral.paper },
  ],
  width: "device-width",
  initialScale: 1,
}

const APPEARANCE_SCRIPT = `(function(){try{
var s=localStorage.getItem("civfix.appearance");
if(s!=="light"&&s!=="dark"&&s!=="system")s="light";
var d=s==="dark"||(s==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark",d);
document.documentElement.style.colorScheme=d?"dark":"light";
}catch(e){}})();`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
