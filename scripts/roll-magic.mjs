#!/usr/bin/env node
/**
 * Roll Nox's magic for an entry written before the roll existed, and add it
 * to the entry's front matter after the creature.
 *
 * Usage:
 *   npm run roll-magic -- 01/001
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pad } from "../src/config/notebook-math.js";
import { rollMagic, magicFrontMatter, describeMagic } from "./lib/magic.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOTEBOOK_DIR = path.join(__dirname, "..", "src", "www", "notebook");

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

const m = /^(\d{1,2})\/(\d{1,3})$/.exec(process.argv[2] ?? "");
if (!m) fail("Expected notebook/page, like 01/001.");
const where = `${pad(Number(m[1]), 2)}/${pad(Number(m[2]), 3)}`;
const file = path.join(NOTEBOOK_DIR, `${where}.md`);
if (!fs.existsSync(file)) fail(`No entry at ${where}.`);

const text = fs.readFileSync(file, "utf8");
if (/^magic:/m.test(text)) fail(`${where} already has a magic roll.`);

// The creature block is the last run of indented lines after "creature:".
const block = /^creature:\n(?:[ \t]+.*\n)+/m.exec(text);
if (!block) fail(`${where} has no creature block.`);

const magic = rollMagic();
const at = block.index + block[0].length;
fs.writeFileSync(file, text.slice(0, at) + magicFrontMatter(magic).join("\n") + "\n" + text.slice(at), "utf8");
console.log(`\n${where}\n${describeMagic(magic)}\n`);
