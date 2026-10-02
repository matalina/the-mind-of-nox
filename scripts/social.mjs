#!/usr/bin/env node
/**
 * Announce new entries on the social accounts set up in .env.
 * npm run publish does this too, after the push.
 *
 * Usage:
 *   npm run social                 # announce entries not yet announced
 *   npm run social -- --dry-run    # show what would be posted
 *   npm run social -- 20/055       # announce one entry again
 *   npm run social -- --mark-done  # record every live entry as announced, post nothing
 *   npm run social -- 20/055 --facebook  # one entry, one platform (also --discord,
 *                                        # --bluesky, --instagram)
 */

import { announce } from "./lib/social.mjs";

const dryRun = process.argv.includes("--dry-run");
const only = process.argv.slice(2).find((a) => /^\d{2}\/\d{3}$/.test(a)) ?? null;
const markDone = process.argv.includes("--mark-done");
const platform = process.argv.find((a) => /^--(discord|bluesky|facebook|instagram)$/.test(a))?.slice(2) ?? null;

try {
  const r = await announce({ dryRun, only, markDone, platform });
  if (r.skipped) console.log(`\n– Social posts skipped: ${r.skipped}.`);
  else {
    console.log(`\nAccounts set up: ${r.ready.join(", ")}`);
    console.log(`${dryRun ? "Would announce" : "Announced"}: ${r.posted.join(", ") || "nothing new"}`);
    if (r.waiting?.length) console.log(`Not live yet: ${r.waiting.join(", ")}`);
    for (const f of r.failed ?? []) console.log(`! ${f}`);
  }
} catch (err) {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
}
