import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PACKAGE = "@civfix/shared";
const MAIN_REF = "refs/remotes/origin/main";
const release = process.argv.includes("--release");

const { version } = JSON.parse(
  readFileSync(new URL("../packages/shared/package.json", import.meta.url), "utf8"),
);
const tag = `${PACKAGE}@${version}`;

const readPublishedVersions = () => {
  try {
    return execFileSync("npm", ["view", PACKAGE, "versions", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr = String(error.stderr ?? "");
    const reason = /\bcode (E[A-Z0-9]+)\b/.exec(stderr)?.[1] ?? String(error.message).split("\n")[0];
    console.error(
      [
        `Could not read the published ${PACKAGE} versions from the registry (${reason}).`,
        "The registry is unreachable or does not hold the package; check the registry in .npmrc and re-run.",
      ].join("\n"),
    );
    process.exit(1);
  }
};

const viewed = JSON.parse(readPublishedVersions());
const published = Array.isArray(viewed) ? viewed : [viewed];

const git = (...args) => spawnSync("git", args, { encoding: "utf8" });
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
  if (ancestry.status > 1) {
    throw new Error(`git merge-base failed: ${ancestry.stderr.trim()}`);
  }
  return ancestry.status === 0;
})();

const parseStable = (candidate) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(candidate);
  return match ? match.slice(1).map(Number) : null;
};
const nextFreeVersion = () => {
  const [major, minor] = published
    .map(parseStable)
    .filter(Boolean)
    .reduce((highest, current) => {
      for (let index = 0; index < 3; index += 1) {
        if (current[index] !== highest[index]) {
          return current[index] > highest[index] ? current : highest;
        }
      }
      return highest;
    }, [0, 0, 0]);
  return `${major}.${minor + 1}.0`;
};

const refuse = (reason) => {
  console.error(
    [
      reason,
      `Set packages/shared/package.json "version" to ${nextFreeVersion()} (after pnpm changeset version)`,
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
