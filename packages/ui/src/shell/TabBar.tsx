/**
 * Platform selector for tooling only (tsc, the .d.ts build, plain Node): Metro and Next resolve the
 * `.native` / `.web` siblings first. Re-exports the worklet-free web seam, safe for Next's SWC pipeline,
 * through the explicit `.web` specifier so it never resolves back into this module.
 */
export { TabBar } from "./TabBar.web"
