/**
 * Platform selector for tooling only (tsc, the .d.ts build, plain Node): Metro and Next resolve the
 * `.native` / `.web` siblings first. Re-exports the gorhom-free web seam through the explicit `.web`
 * specifier so it never resolves back into this module.
 */
export { SearchHeader } from "./SearchHeader.web"
export type { SearchHeaderProps } from "./SearchHeader.types"
