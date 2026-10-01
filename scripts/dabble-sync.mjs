#!/usr/bin/env node
/**
 * Push the notebook entries' creatures to the Creature Ledger in Dabble.
 * npm run publish does this too; run it alone to sync without publishing.
 *
 * Usage:
 *   npm run dabble-sync              # write changes
 *   npm run dabble-sync -- --dry-run # show what would change
 *   npm run dabble-sync -- --check   # show the key's account, scopes and project role
 */

import { syncLedger, checkAccess } from "./lib/dabble.mjs";

const dryRun = process.argv.includes("--dry-run");

if (process.argv.includes("--check")) {
  try {
    const r = await checkAccess();
    if (r.skipped) {
      console.log(`\n– ${r.skipped}.`);
    } else {
      console.log(`\nAccount: ${r.me.name} <${r.me.email}>`);
      console.log(`App: ${r.me.app}`);
      console.log(`Scopes: ${(r.me.scopes ?? []).join(", ") || "none"}`);
      console.log(`Projects this key can see: ${r.count}`);
      console.log(
        r.found
          ? `Project ${r.project}: "${r.found.title}", role ${r.found.role}`
          : `Project ${r.project}: not in this account's project list`,
      );
    }
  } catch (err) {
    console.error(`\n✗ ${err.message}`);
    process.exit(1);
  }
  process.exit(0);
}

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
