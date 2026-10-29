import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PACKAGE = "@civfix/tokens";
const MAIN_REF = "refs/remotes/origin/main";
const release = process.argv.includes("--release");

const manifest = /** @type {unknown} */ (
  JSON.parse(readFileSync(new URL("../packages/tokens/package.json", import.meta.url), "utf8"))
);
const version =
  typeof manifest === "object" && manifest !== null && "version" in manifest ? manifest.version : undefined;
if (typeof version !== "string") throw new Error(`packages/tokens/package.json has no string "version"`);
const tag = `${PACKAGE}@${version}`;

const readPublishedVersions = () => {
  try {
    return execFileSync("npm", ["view", PACKAGE, "versions", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error && typeof error.stderr === "string" ? error.stderr : "";
    const message = error instanceof Error ? error.message : String(error);
    const reason = /\bcode (E[A-Z0-9]+)\b/.exec(stderr)?.[1] ?? message.split("\n")[0] ?? message;
    // The registry answers 404 until the first release, which is a valid starting point, not an outage.
    if (reason === "E404") return "[]";
    console.error(
      [
        `Could not read the published ${PACKAGE} versions from the registry (${reason}).`,
        "The registry is unreachable or does not hold the package; check the registry in .npmrc and re-run.",
      ].join("\n"),
    );
    process.exit(1);
  }
};

// `npm view --json` prints a bare string instead of a one-element array when one version exists.
const viewed = /** @type {unknown} */ (JSON.parse(readPublishedVersions()));
const published = (Array.isArray(viewed) ? viewed : [viewed]).filter(
  /** @returns {candidate is string} */ (candidate) => typeof candidate === "string",
);

/** @param {...string} args */
const git = (...args) => spawnSync("git", args, { encoding: "utf8" });
/** @param {...string} args */
const gitOrThrow = (...args) => {
  const result = git(...args);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
};

const tagCommit = git("rev-parse", "--verify", "--quiet", `refs/tags/${tag}^{commit}`);
const tagExists = tagCommit.status === 0;
const tagOnMain = (() => {
  if (!tagExists) return false;
  const ancestry = git("merge-base", "--is-ancestor", tagCommit.stdout.trim(), MAIN_REF);
  // 0 and 1 are merge-base's yes and no; anything else, including death by a signal, is a failure.
  if (ancestry.status !== 0 && ancestry.status !== 1) {
    throw new Error(`git merge-base failed: ${ancestry.stderr.trim()}`);
  }
  return ancestry.status === 0;
})();

/** @typedef {[major: number, minor: number, patch: number]} Version */

/**
 * @param {string} candidate
 * @returns {Version | null}
 */
const parseStable = (candidate) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(candidate);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
};
/**
 * @param {Version} a
 * @param {Version} b
 */
const compareVersions = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const nextFreeVersion = () => {
  /** @type {Version} */
  const lowest = [0, 0, 0];
  const [major, minor] = published
    .map(parseStable)
    .filter((candidate) => candidate !== null)
    .reduce((highest, current) => (compareVersions(current, highest) > 0 ? current : highest), lowest);
  return `${major}.${minor + 1}.0`;
};

/** @param {string} reason */
const refuse = (reason) => {
  console.error(
    [
      reason,
      `Set packages/tokens/package.json "version" to ${nextFreeVersion()} (after pnpm changeset version)`,
      "and give the matching CHANGELOG.md heading the same number.",
    ].join("\n"),
  );
  process.exit(1);
};

if (tagExists && !tagOnMain) {
  refuse(`The ${tag} tag points at a commit that is not on main, so that version belongs to a branch.`);
}

if (published.includes(version)) {
  if (!tagOnMain) {
    refuse(
      `${tag} is already on the registry but has no tag on main, so main never released it and publishing would silently skip it.`,
    );
  }
  console.log(`${tag} is on the registry and was released from main.`);
  process.exit(0);
}

if (!release) {
  console.log(`${tag} is not on the registry yet.`);
  process.exit(0);
}

if (!tagExists) {
  gitOrThrow("tag", "-a", tag, "-m", tag, "HEAD");
}
gitOrThrow("push", "origin", `refs/tags/${tag}`);
console.log(`${tag} is tagged on main and ready to publish.`);
