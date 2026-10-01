#!/usr/bin/env node
/**
 * Push the notebook entries' creatures to the Creature Ledger in Dabble.
 * npm run publish does this too; run it alone to sync without publishing.
 *
 * Usage:
 *   npm run dabble-sync              # write changes
 *   npm run dabble-sync -- --dry-run # show what would change
 */

import { syncLedger } from "./lib/dabble.mjs";

const dryRun = process.argv.includes("--dry-run");

try {
  const r = await syncLedger({ dryRun });
  if (r.skipped) {
    console.log(`\n– Dabble sync skipped: ${r.skipped}.`);
  } else {
    const verb = dryRun ? "Would update" : "Updated";
    console.log(`\n${verb}: ${r.updated.join(", ") || "nothing"}`);
    console.log(`Already up to date: ${r.unchanged.join(", ") || "none"}`);
    if (r.missing.length) console.log(`No ledger page for: ${r.missing.join(", ")}`);
  }
} catch (err) {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
}
