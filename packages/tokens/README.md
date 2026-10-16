# @civfix/tokens

The civfix design tokens: the colour scales for the light and dark schemes, the report-category and
cleanup pin colours, and the type, spacing, radius and shadow scales, plus the chip-contrast helpers
(`@civfix/tokens/chip-contrast`). Builds to ESM, CJS and `.d.ts` with tsup and has no runtime
dependencies.

It is the single styling source: civfix-app (`@civfix/ui`, web, mobile) consumes it as a workspace
package; civfix-admin, civfix-backend (email layout) and civfix-govt-web install it from
`https://repo.civfix.org`. It must stay framework-free (lint bans React, React Native and
`@civfix/ui`), because the backend installs it.

Releases follow `RELEASING.md` at the repo root: `pnpm changeset`, then `pnpm changeset version`
before merging; `publish-tokens.yml` publishes from `main`.

Until 0.61.0 these tokens shipped inside `@civfix/shared`. `@civfix/contract` keeps its own copy of
the five avatar colours; `__tests__/avatar-palette.test.ts` fails if they drift.
