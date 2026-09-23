/**
 * Platform selector. Metro resolves CompactShell.native.tsx and Next resolves CompactShell.web.tsx (via
 * `.web.tsx` in resolve.extensions) before this file is consulted; only platform-unaware tooling (tsc, the
 * .d.ts build, plain Node) lands here, so it re-exports the worklet-free web seam. The explicit
 * `./CompactShell.web` specifier avoids resolving back into this module.
 */
export { CompactShell } from "./CompactShell.web"
export type { CompactShellProps } from "./CompactShell.types"
