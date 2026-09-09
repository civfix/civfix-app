/**
 * WS subpath barrel: the pure reconnect-backoff helper shared by the web and mobile socket clients.
 * The platform-specific socket lifecycle (connect/teardown, URL, auth, app-state) stays in each app;
 * only this framework-neutral math is shared. Re-exported from the root barrel too.
 */
export * from "./backoff.js"
