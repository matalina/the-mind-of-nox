#!/usr/bin/env node
/**
 * Publish the site: build it, commit the result, and push so Netlify rebuilds
 * and deploys. Cross-platform (pure Node + git, no shell), so it runs
 * identically on Windows and Linux.
 *
 * Usage:
 *   npm run publish                 # auto commit message
 *   npm run publish -- "message"    # custom commit message
 *
 * Along the way it syncs the creatures to the Creature Ledger in Dabble
 * (scripts/lib/dabble.mjs), when DABBLE_API_KEY is set.
 *
 * The deploy branch defaults to `master`; override with NOX_DEPLOY_BRANCH.
 * Publishing is only allowed from that branch (guards against shipping a
 * feature branch by accident).
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncLedger } from "./lib/dabble.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.join(__dirname, "..");
const DEPLOY_BRANCH = process.env.NOX_DEPLOY_BRANCH ?? "master";

/** Run git, capture trimmed stdout. */
function git(args) {
  return execFileSync("git", args, {
    cwd: PROJECT_DIR,
    encoding: "utf8",
  }).trim();
}

/** Run a command with inherited stdio (streams output live). */
function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { cwd: PROJECT_DIR, stdio: "inherit", ...opts });
}

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

// Guard: must be on the deploy branch.
const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
if (branch !== DEPLOY_BRANCH) {
  fail(
    `Not on the deploy branch.\n` +
      `  current: ${branch}\n  deploy:  ${DEPLOY_BRANCH}\n` +
      `Switch with \`git checkout ${DEPLOY_BRANCH}\`, or set NOX_DEPLOY_BRANCH.`,
  );
}

// 1. Build the whole site locally to prove it compiles. Netlify runs this exact
//    command, so a template error caught here means we never push a deploy that
//    would fail on Netlify (and silently leave the live site un-updated).
console.log("\n→ Building site…");
run("npm", ["run", "build"], { shell: true });

// 1b. Push the creatures to the Creature Ledger in Dabble. Never blocks a
//     publish: without a key it is skipped, and a failure is only reported.
console.log("\n→ Syncing the Creature Ledger in Dabble…");
try {
  const r = await syncLedger();
  if (r.skipped) console.log(`  – skipped: ${r.skipped}.`);
  else {
    console.log(`  ✓ updated: ${r.updated.join(", ") || "nothing"}`);
    if (r.missing.length) console.log(`  ! no ledger page for: ${r.missing.join(", ")}`);
  }
} catch (err) {
  console.warn(`  ! Dabble sync failed, publishing anyway: ${err.message}`);
}

// 2. Stage everything.
run("git", ["add", "-A"]);

// 3. Anything to publish?
if (!git(["status", "--porcelain"])) {
  console.log("\n✓ Nothing to publish — site already up to date.");
  process.exit(0);
}

// 4. Commit.
const message =
  process.argv.slice(2).join(" ").trim() ||
  `Publish site (${new Date().toISOString().replace(/\.\d+Z$/, "Z")})`;
console.log(`\n→ Committing on ${branch}…`);
run("git", ["commit", "-m", message]);

// 5. Push → triggers the Netlify build.
console.log(`→ Pushing ${branch} to origin…`);
run("git", ["push", "origin", branch]);

console.log("\n✓ Published. Netlify will build and deploy shortly.");
