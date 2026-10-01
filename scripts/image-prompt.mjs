#!/usr/bin/env node
/**
 * Build the image prompt for an existing notebook page from its creature and
 * doodles, write it into the page's front matter as imagePrompt (replacing
 * any old one), and print it.
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

const doodlesLine = /^doodles:\s*(\[.*\])\s*$/m.exec(text);
if (!doodlesLine) fail("The entry has no doodles. Run npm run roll-night first.");
const doodles = JSON.parse(doodlesLine[1]);

const prompt = imagePrompt({ notebook, age: ageOn(nightMs(notebook, pageNo)), creature, doodles });

// Replace the imagePrompt block, or add one at the end of the front matter.
const block = ["imagePrompt: |", ...prompt.split("\n").map((l) => (l ? `  ${l}` : ""))].join("\n") + "\n";
const end = text.indexOf("\n---", 3) + 1;
const front = text.slice(0, end).replace(/^imagePrompt: \|\n(?:(?: {2}.*)?\n)*/m, "");
fs.writeFileSync(file, front + block + text.slice(end), "utf8");

console.log(`\n${prompt}\n\n(Written to the page's imagePrompt.)\n`);
