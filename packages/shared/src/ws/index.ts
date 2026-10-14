/**
 * WS subpath barrel. The platform-specific socket lifecycle stays in each app; only the framework-neutral
 * reconnect math is shared. Re-exported from the root barrel too.
 */
export * from "./backoff.js"
