#!/usr/bin/env node
/**
 * Add any rolls an entry is missing, for pages written before the roll
 * existed: Nox's magic (after the creature), the coffee stain (1d6) and
 * the doodles. Run npm run image-prompt afterwards to refresh the prompt.
 * Rolls already in the entry are kept.
 *
 * Usage:
 *   npm run roll-night -- 01/001
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pad, nightMs, ageOn } from "../src/config/notebook-math.js";
import { rollMagic, magicFrontMatter, describeMagic } from "./lib/magic.mjs";
import { rollCoffeeStain, describeCoffeeStain } from "./lib/stains.mjs";
import { rollDoodles, describeDoodles } from "./lib/doodles.mjs";

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

let text = fs.readFileSync(file, "utf8");
const report = [];

/** Insert front matter lines after a block: a key line plus its indented lines. */
function insertAfter(pattern, lines) {
  const block = pattern.exec(text);
  if (!block) fail(`${where} has no ${pattern.source.split(":")[0].slice(1)} block.`);
  const at = block.index + block[0].length;
  text = text.slice(0, at) + lines.join("\n") + "\n" + text.slice(at);
}

if (!/^magic:/m.test(text)) {
  const magic = rollMagic();
  insertAfter(/^creature:\n(?:[ \t]+.*\n)+/m, magicFrontMatter(magic));
  report.push(describeMagic(magic));
}

if (!/^coffeeStain:/m.test(text)) {
  const roll = rollCoffeeStain();
  insertAfter(/^manifested:.*\n(?:gmNote:.*\n)?/m, [`coffeeStain: ${roll}`]);
  report.push(describeCoffeeStain(roll));
}

if (!/^doodles:/m.test(text)) {
  const notebook = Number(m[1]);
  const doodles = rollDoodles(ageOn(nightMs(notebook, Number(m[2]))));
  insertAfter(/^coffeeStain:.*\n/m, [`doodles: ${JSON.stringify(doodles)}`]);
  report.push(describeDoodles(doodles, notebook));
}

if (!report.length) fail(`${where} already has every roll.`);
fs.writeFileSync(file, text, "utf8");
console.log(`\n${where}\n${report.join("\n")}\n`);
