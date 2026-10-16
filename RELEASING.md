# Releasing `@civfix/tokens`

`@civfix/tokens` (`packages/tokens`) is the only package this repo publishes. It holds the design
tokens (colour scales for both schemes, the category and cleanup pin colours, type, spacing, radius
and shadow scales) and the chip-contrast helpers. It is published to the private Verdaccio registry at
`https://repo.civfix.org` (scope `@civfix`, anonymous read, authenticated publish).

`@civfix/ui` and both apps are `"private": true` and are NEVER published. Inside this repo,
`@civfix/ui` and both apps take the tokens as `workspace:*`, so a `packages/tokens` or `packages/ui` edit reaches
them immediately: no publish, no range bump, no lockfile dance.

The API contract is NOT released from here. It is `@civfix/contract`, published from
`civfix/civfix-contract` (its `RELEASING.md`, `DECISIONS.md` and `CHANGELOG.md` live there); this repo
is one of its registry consumers
([Adopting a new `@civfix/contract`](#adopting-a-new-civfixcontract)).
Until 0.61.0 the contract and the tokens shipped together as `@civfix/shared` from this repo.

The tokens publish flow exists for the consumers that live OUTSIDE this repo and install them from
the registry: `civfix-admin`, `civfix-backend` (the email layout) and the gov plane
(`civfix-govt-web`).

None of them may ever depend on `@civfix/ui`: the backend isolation is CI-guarded, and
`packages/tokens` bans importing `react` / `react-native` / `@civfix/ui` via ESLint.

## TL;DR

    pnpm changeset  ->  pnpm changeset version  ->  merge to main (CI publishes + tags)
                    ->  bump + reinstall each external consumer

A push to `main` with no applied version bump publishes nothing (a safe no-op). External consumers pin
a version range, not `main`, so an unpublished or un-bumped tokens change is invisible to them.

## When to bump which number

The package version is its public API:

- PATCH (`0.1.0 -> 0.1.1`): backward-compatible fix, such as a corrected colour value, a new exported
  token or helper, an internal or doc change. Existing consumers keep compiling.
- MINOR (`0.1.0 -> 0.2.0`): additive but notable, such as a new scale or scheme. Still backward
  compatible, but consumers will want it.
- MAJOR: a breaking change, such as a removed or renamed token or export. Consumers must update code,
  not just the version.

While the major is `0`, a consumer's caret range pins the MINOR: `^0.1.0` accepts `0.1.x` but NOT
`0.2.0`. So any minor bump must be adopted with a range edit in each external consumer (step 4).

## 1. Add a changeset (while developing)

After the change itself is committed:

```sh
pnpm changeset
```

Pick `@civfix/tokens` and the bump level; it writes a `.changeset/<name>.md`. Commit it with (or right
after) the change. One changeset per logical change; several can accumulate before a release and
`changeset version` folds them all in.

```md
---
"@civfix/tokens": minor
---

Add the hazard pin colour for the dark scheme.
```

A change that touches only `@civfix/ui`, the apps, docs or tooling needs no changeset: nothing is
published for it. (`.changeset/config.json` has `privatePackages: { version: false, tag: false }`, so
`changeset version` leaves the private packages alone; only `@civfix/tokens` is ever published or
tagged.)

## 2. Pre-flight

- Tree clean (`git status --porcelain` prints nothing).
- Green across the workspace: `pnpm install && pnpm build && pnpm typecheck && pnpm lint && pnpm test`.
- The change(s) and their changeset file(s) are committed.
- Sanity-check the published SHAPE when you touched `files`, `exports` or the tsup entries; a
  workspace link resolves paths a registry tarball would not. `pnpm --filter @civfix/tokens pack`
  and inspect the tarball, or install it into a scratch consumer, and confirm both entry points
  (`@civfix/tokens` and `@civfix/tokens/chip-contrast`) resolve from `dist` for `import` and
  `require`.

## 3. Version, then merge to main

```sh
pnpm changeset version
```

This bumps `packages/tokens/package.json`'s `"version"`, writes/extends its `CHANGELOG.md`, and
DELETES the consumed `.changeset/*.md` files. Review the diff, then commit it
(`config.json` has `"commit": false`, so changesets does not commit for you) and merge to `main`.

Do NOT hand-edit the version; let `changeset version` own it. The one exception is a version the
registry already holds from a commit main never released. `scripts/check-tokens-version.mjs` (run by
CI on every PR and by the publish workflow) fails on such a version and names the next free number;
set `"version"` and the new `CHANGELOG.md` heading to it by hand.

`.github/workflows/publish-tokens.yml` then runs on the `main` push:

- `pnpm install --frozen-lockfile`,
- `pnpm --filter @civfix/tokens build` (tsup -> `dist`),
- appends the registry auth line for `repo.civfix.org` to `.npmrc` using the `NPM_TOKEN` repo secret
  (the Verdaccio `ci-publisher` token; never echoed) and restores `.npmrc` at the end,
- `node scripts/check-tokens-version.mjs --release`: the check above, then it creates and pushes the
  `@civfix/tokens@X.Y.Z` tag on the main commit BEFORE anything is published, so a failed tag push
  stops the run and a failed publish is simply retried by the next main push,
- `pnpm changeset publish --no-git-tag`: publishes only when the version is ahead of the registry.

The tokens' versions and tags are package-scoped (`@civfix/tokens@X.Y.Z`). A `vX.Y.Z` tag is
something else entirely: a published `vX.Y.Z` GitHub release is the PRODUCTION deploy of this repo's
web app, and it publishes nothing to the registry.

The workflow only runs on `main`; a manual run on any other branch is skipped. A branch never
publishes a real version; it uses a snapshot (next section).

Verify:

```sh
gh run watch     # wait for "publish @civfix/tokens" to go green
npm view @civfix/tokens version --registry https://repo.civfix.org/
```

## Snapshot of an unmerged branch

When a civfix-admin, civfix-backend or civfix-govt-web branch needs tokens that have not merged yet:

```sh
gh workflow run publish-tokens-snapshot.yml --ref <your-civfix-app-branch>
gh run watch    # the run summary prints the version
```

It publishes `<package.json version>-b-<branch slug>.g<short sha>` (e.g.
`0.1.0-b-feat-hazard-colour.gc8c8f7e`) under the `snapshot` dist-tag. Nothing is committed and no tag
is pushed. A caret range never matches a prerelease, so the consumer branch pins the exact version:

```sh
#   "@civfix/tokens": "0.1.0-b-feat-hazard-colour.gc8c8f7e"
pnpm install
```

The branch must contain this workflow (a manual run uses the branch's own copy of the file), so a
branch cut before it existed needs `git merge origin/main` first. Re-run it after each push to the
civfix-app branch that the consumer needs (a re-run on an unchanged commit fails: that version
already exists). Before the consumer branch merges, the civfix-app PR merges, main publishes the real
version, and the consumer moves back to a caret range (step 4). A consumer PR must never merge while
it pins a snapshot.

## 4. Adopt the new version in each external consumer

The release is not done until every out-of-repo consumer that needs the change is moved onto it.
`@civfix/ui`, web and mobile need nothing; they are in this workspace.

```sh
# in civfix-admin / civfix-backend / civfix-govt-web, from the repo root, on a branch:

# caret crossed (minor/major bump): edit the range, then install
#   "@civfix/tokens": "^0.2.0"
pnpm install

# in-range patch (0.1.0 -> 0.1.1): a plain `pnpm install` is a NO-OP; force the update
pnpm --filter <app> update @civfix/tokens
```

Then run that repo's checks (backend: `pnpm typecheck` + `pnpm test`; admin: typecheck + lint +
build) and commit the manifest and `pnpm-lock.yaml` **together**: a range bump without a refreshed
lockfile leaves CI on the old version. The registry read is anonymous, so consumers need no token to
install.

If you deliberately skip a consumer, say so in the release notes so the others are not assumed to be
up to date.

## Adopting a new `@civfix/contract`

Here this repo is the consumer. `packages/ui`, `apps/community-web` and `apps/community-mobile` each
declare `@civfix/contract` as a caret range (`^0.62.0`), installed from `repo.civfix.org`. A contract
change is a PR in `civfix-contract`, which publishes on merge to its `main`
(`civfix-contract/RELEASING.md`, including its snapshot flow for an unmerged branch); it reaches web
and mobile only through an adoption PR here:

```sh
# from the civfix-app root, on a branch, once the version is on the registry:
npm view @civfix/contract version --registry https://repo.civfix.org/

# caret crossed (new minor on 0.x): edit the range in all three manifests, then install
#   "@civfix/contract": "^0.63.0"
pnpm install

# in-range patch (0.62.0 -> 0.62.1): a plain `pnpm install` is a NO-OP; force the update
pnpm update -r @civfix/contract
```

Then `pnpm build && pnpm typecheck && pnpm lint && pnpm test` (plus `pnpm i18n:check` when locale keys
moved) and commit the three manifests and `pnpm-lock.yaml` **together**. Keep the three ranges
identical.

The legal documents (`legal/documents.ts`: version, effective date, sha256) are part of the contract.
An edit to their text is a contract publish plus an adoption PR here and in civfix-backend; web's
postbuild still checks the hashes.

## Rolling civfix.org back

This is about the web app, not the contract. `deploy-web.yml` deploys production only for the
NEWEST `vX.Y.Z` release merged into `main`, so re-publishing an old release (or running the workflow
on an old tag) is refused rather than silently rolling civfix.org back. To put an older release back
on purpose:

```sh
# Actions -> deploy-web -> Run workflow, "Use workflow from" = the older tag, rollback checked; or:
gh workflow run deploy-web.yml --ref v1.2.3 -f rollback=true
```

The run rebuilds that tag with production values (a static export cannot be byte-promoted) and warns
that it is deploying a release older than the newest one. It is a stopgap: the next release, or any
later run on the newest tag, puts the newest code back. The durable fix is a new release from `main`.
GitHub runs the workflow file as it was at the chosen tag, so this works only for a release whose
`deploy-web.yml` already has the `rollback` input; to go back further, revert on `main` and release.

The backend has no equivalent input. Its production release cannot be re-run on an older tag; roll it
back on the box with `ops/rollback.sh` or `CIVFIX_REF=<tag|sha> ops/deploy.sh`
(`civfix-infra/docs/RELEASING-PROD.md`).

## Checklist

- [ ] Change committed; a `.changeset/*.md` names `@civfix/tokens` and the bump level.
- [ ] Tree clean; `pnpm build && pnpm typecheck && pnpm lint && pnpm test` green across the workspace.
- [ ] Packaged shape sanity-checked if `files` / `exports` / tsup entries changed.
- [ ] `pnpm changeset version` run; the version bump + CHANGELOG entry reviewed and committed.
- [ ] No consumer branch still pins a snapshot version.
- [ ] Merged to `main`; `publish-tokens.yml` green; `npm view @civfix/tokens version --registry
      https://repo.civfix.org/` shows the new version and the `@civfix/tokens@X.Y.Z` tag exists.
- [ ] Every external consumer bumped (civfix-admin, civfix-backend, civfix-govt-web), lockfile
      refreshed, checks green, committed and pushed, or the skip is stated.
- [ ] Backend isolation still green (`pnpm why react react-native react-native-web` -> not found;
      `@civfix/ui` absent from its lockfile).
