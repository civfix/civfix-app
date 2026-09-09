/**
 * SearchHeader (platform-agnostic default) - the sheet search-field seam selector.
 *
 * The barrel imports `./SearchHeader`. At BUNDLE time the platform resolvers pick a sibling seam by
 * extension before this file is consulted:
 *   - Metro (native) resolves `./SearchHeader` -> SearchHeader.native.tsx (BottomSheetTextInput).
 *   - webpack / Next (web) resolves `./SearchHeader` -> SearchHeader.web.tsx (plain TextInput; NO
 *     @gorhom/bottom-sheet), because next.config prepends `.web.tsx` to resolve.extensions.
 *
 * This extension-less file is only consulted by tooling with NO platform awareness - chiefly `tsc`
 * (typecheck + the .d.ts build) and any plain Node resolver. It re-exports the web seam (the gorhom-free
 * one) so that tooling gets a concrete, correct implementation + types. Importing the explicit
 * `./SearchHeader.web` specifier (not the bare `./SearchHeader`) avoids resolving back into this module.
 */
export { SearchHeader } from "./SearchHeader.web"
export type { SearchHeaderProps } from "./SearchHeader.types"
