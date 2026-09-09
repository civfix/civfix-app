/**
 * MediaPreview (platform-agnostic default) - the report media player seam selector.
 *
 * The barrel imports `./MediaPreview`. At BUNDLE time the platform resolvers pick a sibling seam by
 * extension before this file is ever consulted:
 *   - Metro (native) resolves `./MediaPreview` -> MediaPreview.native.tsx (react-native-video).
 *   - webpack / Next (web) resolves `./MediaPreview` -> MediaPreview.web.tsx (HTML5 <video> via RNW),
 *     because next.config prepends `.web.tsx` to resolve.extensions.
 *
 * This extension-less file is only consulted by tooling with NO platform awareness - chiefly `tsc`
 * (typecheck + the .d.ts build) and any plain Node resolver. It re-exports the web seam so that tooling
 * gets a concrete, correct implementation + types. Importing the explicit `./MediaPreview.web` specifier
 * (not the bare `./MediaPreview`) avoids resolving back into this same module. (Mirrors the BlurSurface /
 * SettingsToggle seam: react-native-video is the native-only dependency the .web seam works around.)
 */
export { MediaPreview } from "./MediaPreview.web"
export type { MediaPreviewProps } from "./MediaPreview.types"
