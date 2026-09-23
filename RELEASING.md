# Releasing `@civfix/shared`

`@civfix/shared` (`packages/shared`) is the only publishable package in this repo — the contract: Zod
schemas, inferred types, the vendor-neutral interface seams + in-memory fakes, the design tokens, the
typed API client. It is published to the private Verdaccio registry at `https://repo.civfix.org`
(scope `@civfix`, anonymous read, authenticated publish).

`@civfix/ui` and both apps are `"private": true` and are NEVER published. Inside this repo, web and
mobile take both packages as `workspace:*`, so a `packages/shared` or `packages/ui` edit reaches them
immediately — no publish, no range bump, no lockfile dance.

The publish flow survives for the consumers that live OUTSIDE this repo and install the contract from
the registry:

| Repo | Manifest(s) that declare `@civfix/shared` |
| --- | --- |
| `civfix-backend` | `services/api/package.json`, `services/media-worker/package.json` |
| `civfix-admin` | `apps/admin/package.json` |
| gov plane (`civfix-govt-web`) | its app manifest (tokens-only dependency) |

None of them may ever depend on `@civfix/ui` — the backend isolation is CI-guarded, and
`packages/shared` bans importing `react` / `react-native` / `@civfix/ui` via ESLint.

## TL;DR

    pnpm changeset  ->  pnpm changeset version  ->  merge to main (CI publishes + tags)
                    ->  bump + reinstall each external consumer

A push to `main` with no applied version bump publishes nothing (a safe no-op). External consumers pin
a version range, not `main`, so an unpublished or un-bumped contract change is invisible to them.

## When to bump which number

The package version is its public API:

- PATCH (`0.41.0 -> 0.41.1`): backward-compatible fix — a new optional DTO field, a new exported
  helper, an internal or doc change. Existing consumers keep compiling.
- MINOR (`0.41.0 -> 0.42.0`): additive but notable — a new endpoint, schema or module. Still backward
  compatible, but consumers will want it.
- MAJOR: a breaking change — a removed or renamed export, a newly required field, a changed response
  shape. Consumers must update code, not just the version. Breaking changes need an explicit decision
  first; read `packages/shared/DECISIONS.md`.

While the major is `0`, a consumer's caret range pins the MINOR: `^0.41.0` accepts `0.41.x` but NOT
`0.42.0`. So any minor bump must be adopted with a range edit in each external consumer (step 4).

## 1. Add a changeset (while developing)

After the change itself is committed:

```sh
pnpm changeset
```

Pick `@civfix/shared` and the bump level; it writes a `.changeset/<name>.md`. Commit it with (or right
after) the change. One changeset per logical change; several can accumulate before a release and
`changeset version` folds them all in.

```md
---
"@civfix/shared": minor
---

Add the org-signup endpoints to the client registry.
```

A change that touches only `@civfix/ui`, the apps, docs or tooling needs no changeset — nothing is
published for it. (`.changeset/config.json` has `privatePackages: { version: false, tag: false }`, so
`changeset version` leaves the private packages alone; only `@civfix/shared` is ever published or
tagged.)

## 2. Pre-flight

- Tree clean (`git status --porcelain` prints nothing).
- Green across the workspace: `pnpm install && pnpm build && pnpm typecheck && pnpm lint && pnpm test`.
- The change(s) and their changeset file(s) are committed.
- Sanity-check the published SHAPE when you touched `files`, `exports` or the tsup entries — a
  workspace link resolves paths a registry tarball would not. `pnpm --filter @civfix/shared pack`
  and inspect the tarball, or install it into a scratch consumer, and confirm every subpath
  (`@civfix/shared/tokens`, `/client`, `/interfaces`, `/fakes`, ...) resolves from `dist`.

## 3. Version, then merge to main

```sh
pnpm changeset version
```

This bumps `packages/shared/package.json`'s `"version"`, writes/extends its `CHANGELOG.md`, and
DELETES the consumed `.changeset/*.md` files. Review the diff, then commit it
(`config.json` has `"commit": false`, so changesets does not commit for you) and merge to `main`.

Do NOT hand-edit the version; let `changeset version` own it. The one exception is a version the
registry already holds from a commit main never released: `0.54.0` and `0.55.0` were published from
the `feat/feed-and-polish-batch` branch and are kept, so main's next release is `0.56.0`.
`scripts/check-shared-version.mjs` (run by CI on every PR and by the publish workflow) fails with the
next free number; set `"version"` and the new `CHANGELOG.md` heading to it by hand.

`.github/workflows/publish-shared.yml` then runs on the `main` push:

- appends the registry auth line for `repo.civfix.org` to `.npmrc` using the `NPM_TOKEN` repo secret
  (the Verdaccio `ci-publisher` token; never echoed) and restores `.npmrc` at the end,
- `pnpm install --frozen-lockfile`,
- `pnpm --filter @civfix/shared build` (tsup -> `dist`),
- `node scripts/check-shared-version.mjs --release` — the check above, then it creates and pushes the
  `@civfix/shared@X.Y.Z` tag on the main commit BEFORE anything is published, so a failed tag push
  stops the run and a failed publish is simply retried by the next main push,
- `pnpm changeset publish --no-git-tag` — publishes only when the version is ahead of the registry.

The contract's versions and tags are package-scoped (`@civfix/shared@X.Y.Z`). A `vX.Y.Z` tag is
something else entirely: a published `vX.Y.Z` GitHub release is the PRODUCTION deploy of this repo's
web app, and it publishes nothing to the registry.

The workflow only runs on `main`; a manual run on any other branch is skipped. A branch never
publishes a real version — it uses a snapshot (next section).

Verify:

```sh
gh run watch     # wait for "publish @civfix/shared" to go green
npm view @civfix/shared version --registry https://repo.civfix.org/
```

## Snapshot of an unmerged branch

When a civfix-backend or civfix-admin branch needs contract changes that have not merged yet:

```sh
gh workflow run publish-shared-snapshot.yml --ref <your-civfix-app-branch>
gh run watch    # the run summary prints the version
```

It publishes `<package.json version>-b-<branch slug>.g<short sha>` (e.g.
`0.53.0-b-feat-feed-and-polish-batch.gc8c8f7e`) under the `snapshot` dist-tag. Nothing is committed and
no tag is pushed. A caret range never matches a prerelease, so the consumer branch pins the exact
version:

```sh
#   "@civfix/shared": "0.53.0-b-feat-feed-and-polish-batch.gc8c8f7e"
pnpm install
```

The branch must contain this workflow (a manual run uses the branch's own copy of the file), so a
branch cut before it existed needs `git merge origin/main` first. Re-run it after each push to the
civfix-app branch that the consumer needs (a re-run on an unchanged
commit fails: that version already exists). Before the consumer
branch merges, the civfix-app PR merges, main publishes the real version, and the consumer moves back
to a caret range (step 4). A consumer PR must never merge while it pins a snapshot.

## 4. Adopt the new version in each external consumer

The release is not done until every out-of-repo consumer that needs the change is moved onto it. Web
and mobile need nothing — they are in this workspace.

```sh
# in civfix-backend / civfix-admin / the gov plane, from the repo root, on a branch:

# caret crossed (minor/major bump): edit the range, then install
#   "@civfix/shared": "^0.42.0"
pnpm install

# in-range patch (0.41.0 -> 0.41.1): a plain `pnpm install` is a NO-OP; force the update
pnpm --filter <app> update @civfix/shared
```

Then run that repo's checks (backend: `pnpm typecheck` + `pnpm test`; admin: typecheck + lint +
build) and commit the manifest and `pnpm-lock.yaml` **together** — a range bump without a refreshed
lockfile leaves CI on the old version.

`civfix-backend` declares the contract in TWO manifests (`services/api` and `services/media-worker`);
both move together. The registry read is anonymous, so consumers need no token to install.

If you deliberately skip a consumer, say so in the release notes so the others are not assumed to be
up to date.

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

- [ ] Change committed; a `.changeset/*.md` names `@civfix/shared` and the bump level.
- [ ] Tree clean; `pnpm build && pnpm typecheck && pnpm lint && pnpm test` green across the workspace.
- [ ] Packaged shape sanity-checked if `files` / `exports` / tsup entries changed.
- [ ] `pnpm changeset version` run; the version bump + CHANGELOG entry reviewed and committed.
- [ ] No consumer branch still pins a snapshot version.
- [ ] Merged to `main`; `publish-shared.yml` green; `npm view @civfix/shared version --registry
      https://repo.civfix.org/` shows the new version and the `@civfix/shared@X.Y.Z` tag exists.
- [ ] Every external consumer bumped (civfix-backend x2 manifests, civfix-admin, the gov plane),
      lockfile refreshed, checks green, committed and pushed — or the skip is stated.
- [ ] Backend isolation still green (`pnpm why react react-native react-native-web` -> not found;
      `@civfix/ui` absent from its lockfile).
