import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("./check-shared-version.mjs", import.meta.url));
const stubDirs = [];

after(() => {
  for (const dir of stubDirs) rmSync(dir, { recursive: true, force: true });
});

// npm and git are replaced on PATH so the check runs against a scripted registry and tag state,
// never the real registry or this checkout's refs.
const runWithStubs = ({ npm, git }) => {
  const dir = mkdtempSync(join(tmpdir(), "check-shared-version-"));
  stubDirs.push(dir);
  for (const [name, body] of Object.entries({ npm, git })) {
    const file = join(dir, name);
    writeFileSync(file, `#!/bin/sh\n${body}\n`);
    chmodSync(file, 0o755);
  }
  return spawnSync(process.execPath, [SCRIPT], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH}` },
  });
};

const GIT_TAG_OFF_MAIN = `case "$1" in
  rev-parse) echo 0123456789abcdef0123456789abcdef01234567; exit 0 ;;
  merge-base) exit 1 ;;
esac
exit 2`;

test("an unreachable registry fails with one actionable line, not a stack", () => {
  const result = runWithStubs({
    npm: 'echo "npm error code ENOTFOUND" >&2; exit 1',
    git: "exit 2",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Could not read the published @civfix\/shared versions from the registry \(ENOTFOUND\)/);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
});

test("a package the registry does not hold reports E404 and exits 1", () => {
  const result = runWithStubs({
    npm: 'echo "npm error code E404" >&2; echo "npm error 404 Not Found" >&2; exit 1',
    git: "exit 2",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\(E404\)/);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
});

test("a registry holding only snapshots still names the next free version", () => {
  const result = runWithStubs({
    npm: `echo '["0.1.0-some-branch.gabc1234"]'`,
    git: GIT_TAG_OFF_MAIN,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /points at a commit that is not on main/);
  assert.match(result.stderr, /Set packages\/shared\/package\.json "version" to 0\.1\.0 /);
  assert.doesNotMatch(result.stderr, /TypeError/);
});

test("the next free version is one minor above the highest stable release", () => {
  const result = runWithStubs({
    npm: `echo '["0.9.0", "0.10.2", "0.11.0-snap.gabc1234", "0.10.0"]'`,
    git: GIT_TAG_OFF_MAIN,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /"version" to 0\.11\.0 /);
});
