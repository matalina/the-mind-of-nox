#!/usr/bin/env node
/**
 * Creates a new field-notes post with the correct filename and YAML.
 * Filename: YYYY-MM-DD-YY{CASE_TYPE}-{case#}-{session#}.md
 *
 * Usage:
 *   npm run new-post -- <case_type> <case_number> <session_number>
 * Example:
 *   npm run new-post -- GEN 1 2
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = path.join(__dirname, "..", "src", "www", "posts");

function pad3(n) {
  const num = Number.parseInt(String(n).trim(), 10);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`Invalid number: ${n}`);
  }
  return String(num).padStart(3, "0");
}

function usage() {
  console.error(`
Usage:
  npm run new-post -- <case_type> <case_number> <session_number>

Arguments:
  case_type       Case type code (e.g. GEN), letters/digits only
  case_number     Case number (padded to 3 digits in filename)
  session_number  Session number (padded to 3 digits in filename)

Example:
  npm run new-post -- GEN 1 2
`);
  process.exit(1);
}

const argv = process.argv.slice(2);
if (argv.length < 3) {
  usage();
}

const [rawType, rawCase, rawSession] = argv;
const caseType = String(rawType).trim().toUpperCase();
if (!/^[A-Z0-9]{2,12}$/.test(caseType)) {
  console.error(
    "Error: case_type must be 2–12 letters or digits (e.g. GEN).\n",
  );
  process.exit(1);
}

let casePadded;
let sessionPadded;
try {
  casePadded = pad3(rawCase);
  sessionPadded = pad3(rawSession);
} catch (e) {
  console.error(String(e.message));
  process.exit(1);
}

const caseNum = Number.parseInt(casePadded, 10);
const sessionNum = Number.parseInt(sessionPadded, 10);

const now = new Date();
const y = now.getFullYear();
const m = String(now.getMonth() + 1).padStart(2, "0");
const d = String(now.getDate()).padStart(2, "0");
const isoDate = `${y}-${m}-${d}`;
const year2 = String(y).slice(-2);

const fileBase = `${isoDate}-${year2}${caseType}-${casePadded}-${sessionPadded}`;
const filename = `${fileBase}.md`;
const outPath = path.join(POSTS_DIR, filename);

if (fs.existsSync(outPath)) {
  console.error(`Error: file already exists:\n  ${outPath}`);
  process.exit(1);
}

const frontMatter = `---
layout: post
title: "Field notes"
date: ${isoDate}
year: ${Number(year2)}
case_type: ${caseType}
case_number: ${caseNum}
session: ${sessionNum}
category: Field notes
---

Write your field notes here.

`;

fs.mkdirSync(POSTS_DIR, { recursive: true });
fs.writeFileSync(outPath, frontMatter, "utf8");
console.log(`Created ${outPath}`);
