# @civfix/tokens

The civfix design tokens: the colour scales for the light and dark schemes, the report-category and
cleanup pin colours, and the type, spacing, radius and shadow scales, plus the chip-contrast helpers
(`@civfix/tokens/chip-contrast`). Builds to ESM, CJS and `.d.ts` with tsup and has no runtime
dependencies.

The build (and `dev`, after every watch rebuild) also writes `@civfix/tokens/theme.css`, a Tailwind 4
`@theme` block generated from the same values by `scripts/build-theme.mjs` (radius, shadow, spacing, type, line height, tracking, easing and
the brand colours under the website's utility names). The website imports it from `globals.css`;
`__tests__/theme-css.test.ts` fails when it and the JS tokens disagree.

It is the single styling source: civfix-app (`@civfix/ui`, web, mobile) consumes it as a workspace
package; civfix-admin and civfix-backend (email layout) install it from
`https://repo.civfix.org`. It must stay framework-free (lint bans React, React Native and
`@civfix/ui`), because the backend installs it.

Releases follow `RELEASING.md` at the repo root: `pnpm changeset`, then `pnpm changeset version`
before merging; `publish-tokens.yml` publishes from `main`.

Until 0.61.0 these tokens shipped inside `@civfix/shared`. `@civfix/contract` keeps its own copy of
the five avatar colours; `__tests__/avatar-palette.test.ts` fails if they drift.
