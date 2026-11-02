# @civfix/testing

Private test support for the civfix-app suites. Never published; each workspace imports it as
TypeScript source.

## Console guard

`@civfix/testing/console` fails a test that logs an unexpected `console.error` or `console.warn`, so a
React warning, a contract response that misses its schema or a library deprecation surfaces as a red test
instead of scrolling past in CI.

Every suite loads it as its first setup file: `vitest.console-guard.ts` in `@civfix/tokens`, `@civfix/ui`
and `community-web`, and `tests/setup.mts` (passed to `node --test` with `--import`) in
`community-mobile`. Being first, its `afterEach` runs last and also sees what other hooks' cleanup logs.

A test that is meant to log declares it, and fails if the log never comes:

```ts
import { expectConsoleError, expectConsoleWarn } from "@civfix/testing/console"

it("reports a failed upload", () => {
  expectConsoleError("upload failed") // a substring of the formatted call, or a RegExp
  expectConsoleWarn(/deprecated/i)
  // ...
})
```

## Coverage

`pnpm test:coverage` at the repo root runs every suite with its coverage threshold, as CI does. Each
threshold is the measured baseline rounded down: raise it as coverage grows, never lower it. The vitest
workspaces count every source file their `coverage.include` matches; `community-mobile`'s
`node --test` coverage counts only the files its tests load, so its numbers are not comparable with theirs.
