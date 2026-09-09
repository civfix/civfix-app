// @civfix/ui barrel.
//
// This package ships untranspiled .tsx SOURCE (consumers transpile it via Metro on native and
// react-native-web on web); the build step emits only .d.ts types into dist-types/.
//
// Stage 1 landed the first shared primitive: <Brand/>. Stage 2A-1 adds the infrastructure - the
// token-derived theme, the typography primitives (Text + Icon + semantic icon map), the BlurSurface
// glass seam, and the platform-capability scaffold (context + hooks + fakes). Stage 2B-1 adds the
// bucket-A primitives (Avatar, CountBadge, StatusBadge, MetaDot, TextField, SegmentedCodeInput,
// Toggle, DateBadge). The responsive shells, nav store, and feature bodies arrive in later stages
// (see documents/18-ui-unification.md).
export * from "./primitives"

export * from "./theme"
export * from "./typography"
export * from "./surface"
export * from "./capabilities"
export * from "./data"
export * from "./nav"
export * from "./shell"
export * from "./bodies"
export * from "./map"
export * from "./report"

// Cross-platform full-screen media viewer ("lightbox"): a host mounts <MediaLightboxProvider> once
// near the root (AppShell does this), and any body opens it via useLightbox().open(items, startIndex).
export * from "./lightbox"

// Screen-reader status announcements (WCAG 4.1.3): announce(message) -> aria-live region on web /
// AccessibilityInfo.announceForAccessibility on native. No provider needed.
export * from "./announce"

// Native-app download promo (WEB-ONLY surfaces; inert on native). The card renders in the landscape
// shell's home slot; civfix-web imports useAppPromo/storeLinksFor for the portrait top banner, so both
// surfaces share one decision and one dismissal.
export * from "./promo"
