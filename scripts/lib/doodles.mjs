/**
 * The doodles around each night's drawing, from the nightmare journal tables
 * (src/data/doodles.json): how many by his age, then 1d20 each, with no
 * repeats on a page and knives only from fifteen. The earliest notebooks also
 * carry Sarethai runes in the margins, never rolled.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOODLES = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "src", "data", "doodles.json"), "utf8"),
);

const die = (sides) => 1 + Math.floor(Math.random() * sides);
const byName = new Map(DOODLES.table.map((d) => [d.name, d]));

/** The doodle names for one page. */
export function rollDoodles(age) {
  const c = DOODLES.count.find((band) => age <= band.maxAge);
  const count = die(c.sides) + c.plus;
  const picked = [];
  while (picked.length < count) {
    const d = DOODLES.table[die(20) - 1];
    if (picked.includes(d.name) || (d.minAge && age < d.minAge)) continue;
    picked.push(d.name);
  }
  return picked;
}

export const hasRunes = (notebook) => notebook <= DOODLES.runeNotebooks;

/** What the image generator is asked to draw for each doodle. */
export function doodlePrompts(names, age) {
  return names.map((name) => {
    const d = byName.get(name);
    if (!d) throw new Error(`Unknown doodle "${name}".`);
    return age >= 18 && d.adultPrompt ? d.adultPrompt : d.prompt;
  });
}

export const runesPrompt = () => DOODLES.runes;

export const allowsNumbers = (names) => names.some((n) => byName.get(n)?.numbers);

export function describeDoodles(names, notebook) {
  return `Doodles: ${names.join(", ")}${hasRunes(notebook) ? ", plus runes in the margin" : ""}.`;
}
