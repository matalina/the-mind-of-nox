#!/usr/bin/env node
/**
 * Start a new notebook page: pick a night, roll its creature, write the file,
 * and print the prompt.
 *
 * Usage:
 *   npm run new-night              # a random unwritten night
 *   npm run new-night -- 07/059    # a specific notebook and page
 *
 * Each night also rolls Nox's magic (scripts/lib/magic.mjs).
 *
 * Creature names never repeat: a roll whose name is already used by any
 * entry is rerolled. The tables live in src/data/creatureTables.json.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LAST_NIGHT,
  pagesIn,
  pad,
  nightMs,
  isoDate,
  ageOn,
} from "../src/config/notebook-math.js";
import { imagePrompt } from "./lib/image-prompt.mjs";
import { rollMagic, magicFrontMatter, describeMagic } from "./lib/magic.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.join(__dirname, "..");
const NOTEBOOK_DIR = path.join(PROJECT_DIR, "src", "www", "notebook");
const TABLES = JSON.parse(
  fs.readFileSync(path.join(PROJECT_DIR, "src", "data", "creatureTables.json"), "utf8"),
);

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const nameOf = (c) => `The ${c.movement} ${c.surface} ${c.form} of ${c.features}`;
const key = (notebook, pageNo) => `${pad(notebook, 2)}/${pad(pageNo, 3)}`;

/** Every night from notebook 01, page 001 to the last night, in order. */
function allNights() {
  const nights = [];
  for (let notebook = 1; notebook <= LAST_NIGHT.notebook; notebook++) {
    for (let pageNo = 1; pageNo <= pagesIn(notebook); pageNo++) {
      nights.push({ notebook, pageNo });
    }
  }
  return nights;
}

/** Pages already written, and the creature names they use. */
function existingEntries() {
  const written = new Set();
  const names = new Set();
  if (!fs.existsSync(NOTEBOOK_DIR)) return { written, names };
  for (const dir of fs.readdirSync(NOTEBOOK_DIR)) {
    if (!/^\d{2}$/.test(dir)) continue;
    for (const file of fs.readdirSync(path.join(NOTEBOOK_DIR, dir))) {
      const m = /^(\d{3})\.md$/.exec(file);
      if (!m) continue;
      written.add(`${dir}/${m[1]}`);
      const text = fs.readFileSync(path.join(NOTEBOOK_DIR, dir, file), "utf8");
      const field = (f) =>
        new RegExp(`^\\s+${f}:\\s*"?([^"\\n]+)"?\\s*$`, "m").exec(text)?.[1].trim();
      const parts = ["movement", "surface", "form", "features"].map(field);
      if (parts.every(Boolean)) {
        names.add(nameOf({ movement: parts[0], surface: parts[1], form: parts[2], features: parts[3] }));
      }
    }
  }
  return { written, names };
}

function rollCreature(usedNames) {
  for (let tries = 0; tries < 1000; tries++) {
    const damage = pick(TABLES.damage);
    const c = {
      movement: pick(TABLES.movement),
      surface: pick(TABLES.surface),
      form: pick(TABLES.form),
      features: pick(TABLES.features),
      disposition: pick(TABLES.disposition),
      motivation: pick(TABLES.motivation),
      attack: pick(TABLES.attack[damage]),
      damage,
      special: pick(TABLES.special),
      strength: pick(TABLES.strength),
      weakness: pick(TABLES.weakness),
    };
    if (!usedNames.has(nameOf(c))) return c;
  }
  fail("Could not roll an unused creature name in 1000 tries.");
}

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
}

// ---------- choose the night ----------

const { written, names } = existingEntries();
const nights = allNights();
const arg = process.argv[2];
let night;

if (arg) {
  const m = /^(\d{1,2})\/(\d{1,3})$/.exec(arg);
  if (!m) fail(`Expected notebook/page, like 07/059. Got "${arg}".`);
  night = { notebook: Number(m[1]), pageNo: Number(m[2]) };
  if (!nights.some((n) => n.notebook === night.notebook && n.pageNo === night.pageNo)) {
    fail(`${key(night.notebook, night.pageNo)} is outside the story (01/001 to ${key(LAST_NIGHT.notebook, LAST_NIGHT.pageNo)}).`);
  }
  if (written.has(key(night.notebook, night.pageNo))) {
    fail(`${key(night.notebook, night.pageNo)} is already written.`);
  }
} else {
  const open = nights.filter((n) => !written.has(key(n.notebook, n.pageNo)));
  if (!open.length) fail("Every night has been written.");
  night = pick(open);
}

// ---------- roll and write ----------

const creature = rollCreature(names);
const magic = rollMagic();
const ms = nightMs(night.notebook, night.pageNo);
const where = key(night.notebook, night.pageNo);
const file = path.join(NOTEBOOK_DIR, pad(night.notebook, 2), `${pad(night.pageNo, 3)}.md`);

const prompt = imagePrompt({ notebook: night.notebook, age: ageOn(ms), creature });

// The image prompt sits in front matter so it never shows on the site.
// Delete it once the drawing is made.
const q = (v) => JSON.stringify(v);
const frontMatter = [
  "---",
  `date: ${todayLocal()}`,
  "creature:",
  ...Object.entries(creature).map(([k, v]) => `  ${k}: ${q(v)}`),
  ...magicFrontMatter(magic),
  "imagePrompt: |",
  ...prompt.split("\n").map((line) => (line ? `  ${line}` : "")),
  "---",
  "",
  "",
].join("\n");

fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, frontMatter, "utf8");

const c = creature;
console.log(`
Notebook ${pad(night.notebook, 2)}, page ${pad(night.pageNo, 3)}
${isoDate(ms)}, 3:53am. Nox is ${ageOn(ms)}.

${nameOf(c)} ([${c.disposition}] [Monstrosity]): This creature [${c.motivation}] and attacks with [${c.attack}] for [${c.damage}] damage. It features a unique ability to [${c.special}]. It [${c.strength}] and [${c.weakness}].

${describeMagic(magic)}

Image prompt:

${prompt}

Written to ${path.relative(PROJECT_DIR, file)}
(${written.size + 1} of ${nights.length} nights written)`);
