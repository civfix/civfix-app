/**
 * Capture-step file DROP target (platform-agnostic default selector).
 *
 * The wizard imports `./captureDropTarget`. At BUNDLE time the platform resolvers pick a sibling seam by
 * extension before this file is consulted:
 *   - Metro (native) resolves it to captureDropTarget.native.ts (the inert no-op).
 *   - webpack / Next (web) resolves it to captureDropTarget.web.ts, because next.config prepends
 *     `.web.ts` to resolve.extensions.
 *
 * This extension-less file is only consulted by tooling with NO platform awareness - chiefly `tsc`
 * (typecheck + the .d.ts build) and any plain Node resolver. It re-exports the WEB seam (the same
 * convention as sidebarStorage.ts / searchRevealPlatform.ts) so tooling gets the concrete, correct types.
 */
export {
  useCaptureDropTarget,
  captureDropTargetStyle,
  captureDropActiveStyleFor,
} from "./captureDropTarget.web"
export { isDroppableType, type CaptureDropTarget, type DroppedItem } from "./captureDropTarget.shared"
