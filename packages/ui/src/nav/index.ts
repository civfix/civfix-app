/**
 * @civfix/ui nav barrel (stage 3A): the unified nav store + route helpers + types.
 *
 * Pure logic (zustand + types); no consumer is wired to it yet. The web client's panel-stack and the
 * mobile client's sheetState are merged into this single store; per-app adapters (stage 3B) seed it
 * from deep links via `seedFor` and sync the URL via `pathForEntry`.
 */
export * from "./types"
export * from "./flowKinds"
export * from "./useNavStore"
export * from "./routes"
