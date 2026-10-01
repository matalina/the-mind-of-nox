#!/usr/bin/env node
/**
 * Print the image prompt for an existing notebook page.
 *
 * Usage:
 *   npm run image-prompt -- 01/001
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pad, nightMs, ageOn } from "../src/config/notebook-math.js";
import { imagePrompt } from "./lib/image-prompt.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOTEBOOK_DIR = path.join(__dirname, "..", "src", "www", "notebook");

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

const m = /^(\d{1,2})\/(\d{1,3})$/.exec(process.argv[2] ?? "");
if (!m) fail("Expected notebook/page, like 01/001.");
const notebook = Number(m[1]);
const pageNo = Number(m[2]);
const file = path.join(NOTEBOOK_DIR, pad(notebook, 2), `${pad(pageNo, 3)}.md`);
if (!fs.existsSync(file)) fail(`No entry at ${pad(notebook, 2)}/${pad(pageNo, 3)}.`);

const text = fs.readFileSync(file, "utf8");
const field = (f) =>
  new RegExp(`^\\s+${f}:\\s*"?([^"\\n]+)"?\\s*$`, "m").exec(text)?.[1].trim();
const creature = Object.fromEntries(
  ["movement", "surface", "form", "features"].map((f) => [f, field(f)]),
);
if (!Object.values(creature).every(Boolean)) fail("The entry is missing creature name fields.");

console.log(`\n${imagePrompt({ notebook, age: ageOn(nightMs(notebook, pageNo)), creature })}\n`);
